import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const GEMINI_MODEL = process.env.GEMINI_MODEL_ID?.trim() || "gemini-3.7-flash";
const GEMINI_TIMEOUT_MS = 55_000;

interface BillExtractionResult {
  nom: string | null;
  adresse: string | null;
  conso: number | null;
}

function jsonError(
  message: string,
  status: number,
  extra: Partial<BillExtractionResult> = {},
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      nom: extra.nom ?? null,
      adresse: extra.adresse ?? null,
      conso: extra.conso ?? null,
    },
    { status },
  );
}

function isTransientStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function extractApiErrorMessage(body: string) {
  try {
    const parsed = JSON.parse(body);
    return parsed?.error?.message || body.slice(0, 500);
  } catch {
    return body.slice(0, 500);
  }
}

function buildPrompt() {
  return `Tu es un moteur d'extraction de données spécialisé dans les factures d'électricité françaises.

Analyse attentivement le document PDF joint.

IMPORTANT : le document peut être une facture EDF, Engie, TotalEnergies, un autre fournisseur, ou un document qui n'est PAS une facture. Tu dois extraire uniquement les informations réellement présentes dans le document.

Réponds UNIQUEMENT avec un objet JSON valide ayant exactement ces trois propriétés :
{
  "nom": string | null,
  "adresse": string | null,
  "conso": number | null
}

RÈGLES STRICTES :

1) NOM
- Extrais le nom et prénom du titulaire du contrat, de l'abonné ou du client lorsqu'il est clairement identifiable.
- Si tu ne peux pas l'identifier avec certitude, retourne null.

2) ADRESSE
- Extrais l'adresse physique du lieu de consommation.
- Privilégie "Lieu de consommation", "Adresse du logement", "Adresse du site" ou équivalent.
- Ne prends pas l'adresse postale du fournisseur comme adresse du client.
- Si elle n'est pas identifiable avec certitude, retourne null.

3) CONSOMMATION ANNUELLE
- Recherche en priorité une valeur explicitement annuelle : "Consommation annuelle", "CAR", "Consommation Annuelle de Référence", historique couvrant environ 12 mois, total annuel, etc.
- Si plusieurs périodes consécutives couvrent exactement une année complète sans chevauchement, tu peux additionner les kWh.
- NE CALCULE JAMAIS une consommation en divisant le montant TTC par un prix supposé du kWh.
- N'extrapole pas une période partielle (par exemple 3 mois -> année complète).
- Ne confonds pas puissance souscrite (kVA), puissance du compteur ou puissance instantanée avec consommation en kWh.
- Si aucune consommation annuelle fiable n'est identifiable, retourne null.
- Si le document n'est pas une facture d'électricité, retourne conso: null.

4) VALEURS NUMÉRIQUES
- conso doit être un entier en kWh/an, sans unité dans la valeur JSON.
- N'invente aucune donnée.

5) FORMAT
- Aucun texte avant ou après le JSON.
`;
}

function buildGeminiBody(base64Data: string, promptText: string, includeResponseFormat: boolean) {
  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
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

  // Gemini's current REST generateContent format for structured JSON.
  // Kept isolated so we can retry without it if a deployment rejects this field.
  if (includeResponseFormat) {
    body.generationConfig = {
      responseFormat: {
        text: {
          mimeType: "application/json",
        },
      },
    };
  }

  return body;
}

async function requestGemini(
  base64Data: string,
  promptText: string,
  apiKey: string,
  includeResponseFormat: boolean,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const body = buildGeminiBody(base64Data, promptText, includeResponseFormat);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.ok) return response;

      const errorText = await response.text().catch(() => "");
      const errorMessage = extractApiErrorMessage(errorText);
      console.error(
        `[parse-bill] Gemini HTTP ${response.status} (tentative ${attempt + 1}, responseFormat=${includeResponseFormat}): ${errorMessage}`,
      );

      if (isTransientStatus(response.status) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        continue;
      }

      return {
        response,
        errorText,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("Échec de la communication avec Gemini après plusieurs tentatives.");
}

function normalizeExtraction(value: unknown): BillExtractionResult {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};

  const nom = typeof source.nom === "string" && source.nom.trim() ? source.nom.trim() : null;
  const adresse = typeof source.adresse === "string" && source.adresse.trim() ? source.adresse.trim() : null;
  const conso = typeof source.conso === "number" && Number.isFinite(source.conso) && source.conso > 0
    ? Math.round(source.conso)
    : null;

  return { nom, adresse, conso };
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.error("[parse-bill] GEMINI_API_KEY manquante.");
      return jsonError("Le service d'analyse est temporairement indisponible.", 500);
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("Aucun fichier PDF reçu.", 400);
    }

    if (file.size === 0) {
      return jsonError("Le fichier téléversé est vide.", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonError("Le fichier dépasse la taille maximale autorisée de 10 Mo.", 400);
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return jsonError("Veuillez téléverser une facture au format PDF.", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Basic magic-byte check. It prevents renamed non-PDF files from reaching the model.
    const isPdfSignature = bytes.length >= 5 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;

    if (!isPdfSignature) {
      return jsonError("Le fichier ne semble pas être un PDF valide.", 400);
    }

    const base64Data = Buffer.from(bytes).toString("base64");
    const promptText = buildPrompt();

    console.info(
      `[parse-bill] PDF reçu (${Math.round(file.size / 1024)} Ko). Analyse avec ${GEMINI_MODEL}.`,
    );

    let firstAttempt: Awaited<ReturnType<typeof requestGemini>>;

    try {
      // Current REST structured-output syntax.
      firstAttempt = await requestGemini(base64Data, promptText, apiKey, true) as Awaited<ReturnType<typeof requestGemini>>;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        return jsonError("Le délai d'analyse a été dépassé. Réessayez avec un PDF plus léger.", 504);
      }
      throw error;
    }

    let geminiResponse: Response;
    if (firstAttempt instanceof Response) {
      geminiResponse = firstAttempt;
    } else {
      // If the current endpoint rejects structured output configuration, retry once
      // with plain text and keep the JSON contract in the prompt.
      const errorMessage = extractApiErrorMessage(firstAttempt.errorText);
      const looksLikeFormatIssue = firstAttempt.response.status === 400 && /response.?format|mime.?type|schema|generation.?config/i.test(errorMessage);

      if (!looksLikeFormatIssue) {
        const message = firstAttempt.response.status === 429
          ? "Le service d'analyse est momentanément saturé. Réessayez dans quelques secondes."
          : firstAttempt.response.status >= 500
          ? "Le service d'analyse est temporairement indisponible. Réessayez dans quelques instants."
          : "La facture n'a pas pu être analysée. Vérifiez que le PDF est lisible.";
        return jsonError(message, firstAttempt.response.status);
      }

      console.warn("[parse-bill] Repli automatique sans responseFormat suite à une erreur de format Gemini.");

      let fallbackAttempt: Awaited<ReturnType<typeof requestGemini>>;
      try {
        fallbackAttempt = await requestGemini(base64Data, promptText, apiKey, false) as Awaited<ReturnType<typeof requestGemini>>;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          return jsonError("Le délai d'analyse a été dépassé. Réessayez avec un PDF plus léger.", 504);
        }
        throw error;
      }

      if (!(fallbackAttempt instanceof Response)) {
        const fallbackMessage = extractApiErrorMessage(fallbackAttempt.errorText);
        console.error(`[parse-bill] Gemini fallback en échec: ${fallbackMessage}`);
        return jsonError("Le moteur d'analyse n'a pas pu traiter cette facture. Réessayez avec un autre PDF.", fallbackAttempt.response.status);
      }

      geminiResponse = fallbackAttempt;
    }

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text().catch(() => "");
      const errorMessage = extractApiErrorMessage(errorBody);
      console.error(`[parse-bill] Erreur Gemini définitive HTTP ${geminiResponse.status}: ${errorMessage}`);

      const userMessage = geminiResponse.status === 400
        ? "La facture n'a pas pu être traitée. Vérifiez que le PDF est lisible."
        : geminiResponse.status === 401 || geminiResponse.status === 403
        ? "Le service d'analyse n'est pas correctement configuré."
        : geminiResponse.status === 404
        ? "Le modèle d'analyse est indisponible. Vérifiez GEMINI_MODEL_ID."
        : "Le service d'analyse est temporairement indisponible.";

      return jsonError(userMessage, geminiResponse.status);
    }

    const geminiData = await geminiResponse.json();
    const parts = geminiData?.candidates?.[0]?.content?.parts;
    const rawText = Array.isArray(parts)
      ? parts.map((part: { text?: unknown }) => typeof part?.text === "string" ? part.text : "").join("").trim()
      : "";

    if (!rawText) {
      console.error("[parse-bill] Gemini n'a renvoyé aucun texte exploitable.");
      return jsonError("Aucune information exploitable n'a été extraite de cette facture.", 422);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Small recovery for models that accidentally wrap JSON in markdown fences.
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error("[parse-bill] Réponse Gemini non JSON.");
        return jsonError("La réponse du moteur d'analyse n'a pas pu être interprétée.", 422);
      }
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        console.error("[parse-bill] Impossible de décoder le JSON récupéré.");
        return jsonError("La réponse du moteur d'analyse n'a pas pu être interprétée.", 422);
      }
    }

    const result = normalizeExtraction(parsed);

    console.info(
      `[parse-bill] Extraction: nom=${result.nom ? "oui" : "non"}, adresse=${result.adresse ? "oui" : "non"}, conso=${result.conso ?? "non déterminée"}`,
    );

    if (!result.nom && !result.adresse && result.conso === null) {
      return jsonError(
        "Aucune donnée fiable n'a pu être détectée. Vérifiez qu'il s'agit bien d'une facture d'électricité lisible.",
        422,
      );
    }

    if (result.conso === null) {
      return NextResponse.json({
        success: false,
        error: "La consommation annuelle n'a pas pu être déterminée de manière fiable. Vérifiez ou saisissez-la manuellement.",
        ...result,
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[parse-bill] Timeout Gemini.");
      return jsonError("Le délai d'analyse a été dépassé. Réessayez avec un PDF plus léger.", 504);
    }

    console.error(
      "[parse-bill] Exception serveur:",
      error instanceof Error ? error.message : error,
    );
    return jsonError("Une erreur inattendue est survenue lors de l'analyse de la facture.", 500);
  }
}
