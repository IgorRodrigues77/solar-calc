import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const GEMINI_MODEL = "gemini-3.7-flash";
const GEMINI_TIMEOUT_MS = 55_000;

interface BillExtractionResult {
  nom: string | null;
  adresse: string | null;
  conso: number | null;
}

function jsonError(
  message: string,
  status: number,
  extra: Partial<BillExtractionResult> = {}
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      nom: extra.nom ?? null,
      adresse: extra.adresse ?? null,
      conso: extra.conso ?? null,
    },
    { status }
  );
}

function extractJsonObject(text: string): BillExtractionResult | null {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

  try {
    return JSON.parse(cleaned) as BillExtractionResult;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;

    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as BillExtractionResult;
    } catch {
      return null;
    }
  }
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGemini(
  base64Data: string,
  promptText: string,
  apiKey: string,
  useStructuredOutput: boolean
): Promise<Response> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const body: Record<string, unknown> = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data,
            },
          },
        ],
      },
    ],
  };

  if (useStructuredOutput) {
    body.generationConfig = {
      responseFormat: {
        text: {
          mimeType: "application/json",
          schema: {
            type: "object",
            properties: {
              nom: { type: "string", nullable: true },
              adresse: { type: "string", nullable: true },
              conso: { type: "integer", nullable: true },
            },
            required: ["nom", "adresse", "conso"],
          },
        },
      },
    };
  }

  return fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "parse-bill",
    model: GEMINI_MODEL,
  });
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      console.error("[parse-bill] GEMINI_API_KEY manquante.");
      return jsonError("Service d'analyse temporairement indisponible.", 500);
    }

    const formData = await req.formData();
    const entry = formData.get("file");

    if (!(entry instanceof File)) {
      return jsonError("Aucun fichier PDF n'a été reçu.", 400);
    }

    if (entry.size <= 0) {
      return jsonError("Le fichier sélectionné est vide.", 400);
    }

    if (entry.size > MAX_FILE_SIZE) {
      return jsonError("Le fichier dépasse la taille maximale autorisée (10 Mo).", 413);
    }

    const fileName = entry.name || "facture.pdf";
    const isPdf =
      entry.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return jsonError("Veuillez sélectionner une facture au format PDF.", 415);
    }

    const buffer = Buffer.from(await entry.arrayBuffer());
    if (!buffer.length) {
      return jsonError("Impossible de lire le fichier PDF.", 400);
    }

    const pdfSignature = buffer.subarray(0, 5).toString("utf8");
    if (pdfSignature !== "%PDF-") {
      return jsonError("Le fichier sélectionné ne semble pas être un PDF valide.", 400);
    }

    const base64Data = buffer.toString("base64");

    const promptText = `
Vous êtes un moteur d'extraction de données spécialisé dans les factures françaises d'électricité.

Analysez UNIQUEMENT le document PDF fourni et retournez les trois champs demandés.

CHAMPS À EXTRAIRE :
- nom : nom et prénom du titulaire du contrat / client.
- adresse : adresse complète du lieu de consommation (numéro, voie, code postal, ville).
- conso : consommation annuelle en kWh.

RÈGLES IMPÉRATIVES :
1. Ne fabriquez aucune donnée.
2. Pour 
"conso", utilisez uniquement une consommation annuelle explicitement indiquée ou déductible d'un historique couvrant réellement 12 mois / 365 jours sans chevauchement.
3. Une valeur comme "Consommation Annuelle de Référence (CAR)" est prioritaire.
4. Si plusieurs périodes consécutives couvrent exactement une année et que leurs kWh sont clairement lisibles, vous pouvez les additionner.
5. N'utilisez JAMAIS le montant TTC, HT, l'abonnement ou les taxes pour estimer des kWh.
6. N'extrapolez PAS une période partielle à une année.
7. Si la consommation annuelle fiable n'est pas disponible, retournez null pour "conso".
8. Pour "nom" et "adresse", retournez null si l'information n'est pas identifiable de manière fiable.
9. "conso" doit être un entier positif ou null.
10. Retournez uniquement un objet JSON sans markdown ni commentaire.

Format exact :
{
  "nom": string | null,
  "adresse": string | null,
  "conso": integer | null
}
`;

    let geminiResponse: Response;

    try {
      // Primary attempt: current structured-output format for generateContent.
      geminiResponse = await callGemini(
        base64Data,
        promptText,
        apiKey,
        true
      );

      // Compatibility fallback: if the API rejects structured-output configuration,
      // retry once without response formatting and rely on the strict JSON prompt.
      if (geminiResponse.status === 400) {
        const firstError = await geminiResponse.text().catch(() => "");
        console.warn(
          "[parse-bill] Structured output rejected by Gemini; retrying without responseFormat.",
          firstError.slice(0, 300)
        );

        geminiResponse = await callGemini(
          base64Data,
          promptText,
          apiKey,
          false
        );
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        return jsonError(
          "L'analyse de la facture a pris trop de temps. Réessayez avec un PDF plus léger.",
          504
        );
      }

      console.error("[parse-bill] Erreur réseau Gemini:", error);
      return jsonError(
        "Le moteur d'analyse n'a pas pu être contacté. Réessayez dans quelques instants.",
        502
      );
    }

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text().catch(() => "");
      console.error(
        `[parse-bill] Gemini HTTP ${geminiResponse.status}:`,
        errorBody.slice(0, 800)
      );

      if (geminiResponse.status === 401 || geminiResponse.status === 403) {
        return jsonError(
          "Le service d'analyse est mal configuré. Vérifiez la clé API Gemini sur Vercel.",
          502
        );
      }

      if (geminiResponse.status === 429) {
        return jsonError(
          "Le service d'analyse est momentanément saturé. Réessayez dans quelques instants.",
          429
        );
      }

      if (geminiResponse.status === 404) {
        return jsonError(
          "Le modèle d'analyse est indisponible. Vérifiez la configuration du modèle Gemini.",
          502
        );
      }

      return jsonError(
        "Impossible d'analyser cette facture. Réessayez avec un autre PDF.",
        502
      );
    }

    const geminiData = await geminiResponse.json().catch(() => null);
    const rawText = geminiData?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part?.text || "")
      .join("")
      .trim();

    if (!rawText) {
      console.error(
        "[parse-bill] Gemini n'a renvoyé aucun texte exploitable.",
        JSON.stringify(geminiData).slice(0, 500)
      );
      return jsonError(
        "Aucune donnée exploitable n'a pu être extraite de cette facture.",
        422
      );
    }

    const parsed = extractJsonObject(rawText);

    if (!parsed) {
      console.error(
        "[parse-bill] Réponse Gemini non JSON:",
        rawText.slice(0, 800)
      );
      return jsonError(
        "La réponse du moteur d'analyse n'est pas exploitable. Réessayez avec cette facture.",
        422
      );
    }

    const nom =
      typeof parsed.nom === "string" && parsed.nom.trim().length > 0
        ? parsed.nom.trim()
        : null;

    const adresse =
      typeof parsed.adresse === "string" && parsed.adresse.trim().length > 0
        ? parsed.adresse.trim()
        : null;

    const conso =
      typeof parsed.conso === "number" &&
      Number.isFinite(parsed.conso) &&
      parsed.conso > 0
        ? Math.round(parsed.conso)
        : null;

    console.info(
      `[parse-bill] Extraction: nom=${nom ? "oui" : "non"}, adresse=${
        adresse ? "oui" : "non"
      }, conso=${conso !== null ? `${conso} kWh/an` : "non déterminable"}`
    );

    return NextResponse.json({
      success: true,
      nom,
      adresse,
      conso,
      requiresManualConsumption: conso === null,
    });
  } catch (error: unknown) {
    console.error(
      "[parse-bill] Exception serveur:",
      error instanceof Error ? error.message : error
    );

    return jsonError(
      "Une erreur inattendue est survenue pendant l'analyse de la facture.",
      500
    );
  }
}
