import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
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

/**
 * Appel REST direct à Gemini GenerateContent.
 * IMPORTANT: cette URL doit rester une URL HTTP réelle, sem markdown.
 */
async function callGemini(
  base64Data: string,
  promptText: string,
  apiKey: string
): Promise<Response> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data,
            },
          },
          { text: promptText },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          nom: { type: "STRING", nullable: true },
          adresse: { type: "STRING", nullable: true },
          conso: { type: "INTEGER", nullable: true },
        },
        required: ["nom", "adresse", "conso"],
      },
    },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      GEMINI_TIMEOUT_MS
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify(body),
        cache: "no-store",
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      const errorText = await response.text().catch(() => "");
      console.error(
        `[parse-bill] Gemini HTTP ${response.status} (tentative ${attempt + 1}):`,
        errorText.slice(0, 800)
      );

      const retryable = response.status === 429 || response.status >= 500;

      if (retryable && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        continue;
      }

      return new Response(errorText, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  throw new Error("Échec après plusieurs tentatives auprès de Gemini.");
}

/**
 * Endpoint de diagnostic.
 * Acessível em GET /api/parse-bill para confirmar que a route foi déployée.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "parse-bill",
    model: GEMINI_MODEL,
  });
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim() === "") {
      console.error(
        "[parse-bill] GEMINI_API_KEY manquante dans les variables d'environnement."
      );
      return jsonError(
        "Service d'extraction temporairement indisponible.",
        500
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("Aucun fichier PDF n'a été reçu.", 400);
    }

    if (file.size <= 0) {
      return jsonError("Le fichier téléversé est vide.", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonError(
        "Le fichier dépasse la taille maximale autorisée de 10 Mo.",
        400
      );
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return jsonError(
        "Veuillez téléverser une facture au format PDF.",
        400
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      return jsonError("Le fichier téléversé est vide.", 400);
    }

    // Vérification légère de la signature PDF (%PDF-), sans bloquer les PDF valides
    // dont certains navigateurs/serveurs déclarent mal le MIME type.
    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 5));
    const pdfSignature = String.fromCharCode(...firstBytes);

    if (pdfSignature !== "%PDF-") {
      return jsonError(
        "Le document ne semble pas être un PDF valide.",
        400
      );
    }

    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    console.info(
      `[parse-bill] PDF reçu: ${file.name} (${Math.round(
        file.size / 1024
      )} Ko). Envoi à ${GEMINI_MODEL}...`
    );

    const promptText = `Vous analysez une facture d'électricité française.

Votre mission est d'extraire uniquement trois informations vérifiables dans le document :
- nom du titulaire du contrat ;
- adresse du lieu de consommation ;
- consommation annuelle en kWh.

Retournez exclusivement un objet JSON correspondant au schéma demandé.

RÈGLES IMPORTANTES POUR LA CONSOMMATION :
1. Cherchez en priorité une valeur explicitement annuelle, par exemple :
   - "Consommation Annuelle de Référence" (CAR) ;
   - "consommation annuelle" ;
   - un total couvrant clairement 12 mois / une année complète.
2. Si plusieurs périodes consécutives couvrent exactement une année complète sans chevauchement, vous pouvez additionner les consommations en kWh.
3. NE CALCULEZ JAMAIS la consommation en divisant une facture en euros par un prix supposé du kWh.
4. N'extrapolez jamais automatiquement une consommation de quelques mois vers une année.
5. Si la consommation annuelle ne peut pas être déterminée de manière fiable, retournez null pour conso.
6. Ne créez, n'inventez ou ne déduisez aucune valeur absente du document.

Pour l'adresse, privilégiez l'adresse du lieu de consommation plutôt que l'adresse de facturation si elles sont différentes.

Même si le document semble être une étude, un devis ou un autre document et non une facture d'électricité, ne fabriquez aucune donnée : retournez uniquement ce qui est réellement identifiable et conso=null si aucune consommation annuelle fiable n'est présente.`;

    let geminiResponse: Response;

    try {
      geminiResponse = await callGemini(base64Data, promptText, apiKey);
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.error("[parse-bill] Timeout Gemini.");
        return jsonError(
          "L'analyse a pris trop de temps. Réessayez avec un PDF plus léger.",
          504
        );
      }

      console.error(
        "[parse-bill] Erreur réseau vers Gemini:",
        error?.message || error
      );

      return jsonError(
        "Impossible de communiquer avec le moteur d'analyse. Réessayez dans quelques instants.",
        502
      );
    }

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text().catch(() => "");

      console.error(
        `[parse-bill] Gemini a refusé le document (HTTP ${geminiResponse.status}):`,
        errorBody.slice(0, 1000)
      );

      if (geminiResponse.status === 400) {
        return jsonError(
          "Gemini a refusé la requête. Vérifiez que la facture est un PDF lisible et que la clé API Gemini est correctement configurée.",
          502
        );
      }

      if (geminiResponse.status === 401 || geminiResponse.status === 403) {
        return jsonError(
          "Le service d'analyse n'est pas correctement authentifié. Vérifiez la clé API Gemini.",
          502
        );
      }

      if (geminiResponse.status === 404) {
        return jsonError(
          "Le modèle Gemini configuré est introuvable. Vérifiez la configuration de l'API Gemini.",
          502
        );
      }

      if (geminiResponse.status === 429) {
        return jsonError(
          "Le service d'analyse est momentanément saturé. Réessayez dans quelques instants.",
          503
        );
      }

      return jsonError(
        "Le moteur d'analyse n'a pas pu traiter cette facture. Réessayez avec un autre PDF.",
        502
      );
    }

    let geminiData: any;

    try {
      geminiData = await geminiResponse.json();
    } catch {
      return jsonError(
        "La réponse du moteur d'analyse est invalide.",
        502
      );
    }

    const rawContent =
      geminiData?.candidates?.[0]?.content?.parts?.find(
        (part: any) => typeof part?.text === "string"
      )?.text ?? null;

    if (!rawContent) {
      console.warn(
        "[parse-bill] Gemini a renvoyé une réponse sans contenu exploitable."
      );
      return jsonError(
        "Aucune donnée exploitable n'a été détectée dans cette facture.",
        422
      );
    }

    let parsed: BillExtractionResult;

    try {
      parsed = JSON.parse(rawContent);
    } catch (error) {
      console.error(
        "[parse-bill] Réponse JSON invalide:",
        rawContent.slice(0, 500),
        error
      );
      return jsonError(
        "La réponse du moteur d'analyse n'est pas conforme au format attendu.",
        502
      );
    }

    const nom =
      typeof parsed?.nom === "string" && parsed.nom.trim().length > 0
        ? parsed.nom.trim()
        : null;

    const adresse =
      typeof parsed?.adresse === "string" && parsed.adresse.trim().length > 0
        ? parsed.adresse.trim()
        : null;

    const conso =
      typeof parsed?.conso === "number" &&
      Number.isFinite(parsed.conso) &&
      parsed.conso > 0
        ? Math.round(parsed.conso)
        : null;

    console.info(
      `[parse-bill] Extraction: nom=${nom ? "oui" : "non"}, adresse=${
        adresse ? "oui" : "non"
      }, conso=${conso !== null ? `${conso} kWh/an` : "non déterminable"}`
    );

    if (conso === null) {
      return NextResponse.json({
        success: false,
        error:
          "La consommation annuelle n'a pas pu être déterminée de manière fiable. Veuillez la vérifier et la saisir manuellement.",
        nom,
        adresse,
        conso: null,
      });
    }

    return NextResponse.json({
      success: true,
      nom,
      adresse,
      conso,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return jsonError(
        "L'analyse a pris trop de temps. Réessayez avec un PDF plus léger.",
        504
      );
    }

    console.error(
      "[parse-bill] Exception serveur non gérée:",
      error?.message || error
    );

    return jsonError(
      "Une erreur inattendue est survenue lors de l'analyse de la facture.",
      500
    );
  }
}
