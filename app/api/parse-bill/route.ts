import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // Limite de 10 MB
const GEMINI_MODEL = process.env.GEMINI_MODEL_ID?.trim() || "gemini-1.5-flash";
const GEMINI_TIMEOUT_MS = 55_000;

interface BillExtractionResult {
  nom: string | null;
  adresse: string | null;
  conso: number | null;
}

function jsonError(message: string, status: number, extra: Partial<BillExtractionResult> = {}) {
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

async function callGemini(base64Data: string, promptText: string, apiKey: string): Promise<Response> {
  const url = `[generativelanguage.googleapis.com](https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent)`;

  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: "application/pdf", data: base64Data } },
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

  // Une tentative, puis un retry silencieux en cas d'erreur transitoire (429 / 5xx).
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      clearTimeout(timeoutId);

      if (res.ok) return res;

      const errText = await res.text();
      console.error(`[parse-bill] Gemini HTTP ${res.status} (tentative ${attempt + 1}):`, errText.slice(0, 500));

      const isTransient = res.status === 429 || res.status >= 500;
      if (isTransient && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      return res; // Erreur définitive : on la remonte telle quelle à l'appelant.
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  throw new Error("Échec après plusieurs tentatives.");
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.error("[parse-bill] ERREUR: GEMINI_API_KEY manquante dans les variables d'environnement.");
      return jsonError("Service d'extraction temporairement indisponible (clé API non configurée).", 500);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return jsonError("Aucun fichier reçu.", 400);
    }

    // 1. Validação de tamanho
    if (file.size > MAX_FILE_SIZE) {
      return jsonError("Le fichier dépasse la taille maximale autorisée (10 Mo).", 400);
    }

    // 2. Validação de formato PDF
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return jsonError("Veuillez téléverser un document au format PDF valide.", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return jsonError("Le fichier téléversé est vide.", 400);
    }

    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    console.info(
      `[parse-bill] Fichier PDF reçu: ${file.name} (${Math.round(file.size / 1024)} Ko). Envoi à ${GEMINI_MODEL}...`
    );

    const promptText = `Vous êtes un système OCR et d'analyse de données de haute précision, spécialisé dans les factures d'électricité françaises (EDF, TotalEnergies, Engie, Enedis, etc.).

Analysez méticuleusement le document PDF joint et extrayez STRICTEMENT les données suivantes au format JSON pur :

{
  "nom": string | null,
  "adresse": string | null,
  "conso": number | null
}

RÈGLES D'EXTRACTION STRICTES :
1. "nom" :
   - Extrayez le nom et prénom complets du titulaire du contrat ou client (ex: "M. PIERRE BOKOBZA").
   - Si introuvable, retournez null.

2. "adresse" :
   - Extrayez l'adresse physique complète du lieu de consommation (numéro, voie, code postal et ville).
   - Privilégiez l'adresse indiquée sous "Lieu de consommation" ou adresse du site.
   - Si introuvable, retournez null.

3. "conso" (Consommation annuelle en kWh) :
   - RÈGLE PRIORITAIRE A : Cherchez la consommation annuelle explicite (mention "Consommation Annuelle de Référence - CAR", "Consommation annuelle", ou total sur 12 mois/365 jours en kWh).
   - RÈGLE PRIORITAIRE B : S'il y a plusieurs périodes consécutives couvrant une année complète sans chevauchement, additionnez les kWh.
   - RÈGLE D'OR / INTERDICTION : NE CALCULEZ JAMAIS la consommation en divisant un montant en euros (€ TTC) par un prix estimé du kWh (les factures contiennent des abonnements, taxes CSPE/CTA, TVA et périodes partielles).
   - Si la facture ne mentionne qu'une consommation partielle (ex: 2 mois, 4 mois) sans historique annuel complet ou si l'information annuelle fiable est introuvable, RETOURNEZ OBLIGATOIREMENT null.
   - Si une valeur annuelle en kWh est confirmée, retournez-la sous forme d'un nombre entier arrondi (ex: 4250).

Ne renvoyez ABSOLUMENT AUCUN texte avant ou après l'objet JSON.`;

    let geminiRes: Response;
    try {
      geminiRes = await callGemini(base64Data, promptText, apiKey);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        console.error("[parse-bill] Timeout lors de l'analyse du document.");
        return jsonError("Le délai d'analyse a été dépassé. Le document est peut-être trop volumineux.", 504);
      }
      throw err;
    }

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text().catch(() => "");
      console.error(`[parse-bill] Erreur API Gemini (HTTP ${geminiRes.status}):`, errBody.slice(0, 500));

      const message =
        geminiRes.status === 400
          ? "Le document n'a pas pu être traité par le moteur d'analyse (format ou requête invalide)."
          : geminiRes.status === 404
          ? "Le modèle d'analyse configuré est introuvable. Vérifiez la variable GEMINI_MODEL_ID."
          : "Échec de la communication avec le moteur d'analyse IA.";

      return jsonError(message, geminiRes.status);
    }

    const geminiData = await geminiRes.json();
    const rawContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      console.warn("[parse-bill] Gemini a renvoyé une réponse sans contenu texte.", JSON.stringify(geminiData).slice(0, 300));
      return jsonError("Impossible d'extraire le contenu textuel de ce document.", 422);
    }

    let parsed: BillExtractionResult;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error("[parse-bill] Erreur de décodage JSON:", parseErr, rawContent.slice(0, 300));
      return jsonError("Réponse du modèle non conforme au format attendu.", 500);
    }

    const nom = typeof parsed.nom === "string" && parsed.nom.trim().length > 0 ? parsed.nom.trim() : null;
    const adresse = typeof parsed.adresse === "string" && parsed.adresse.trim().length > 0 ? parsed.adresse.trim() : null;
    const conso = typeof parsed.conso === "number" && !isNaN(parsed.conso) && parsed.conso > 0 ? Math.round(parsed.conso) : null;

    console.info(
      `[parse-bill] Extraction réussie - Titulaire: ${nom ? "Oui" : "Non"}, Adresse: ${adresse ? "Oui" : "Non"}, Conso annuelle: ${conso !== null ? `${conso} kWh` : "Non déterminable"}`
    );

    if (conso === null) {
      return NextResponse.json({
        success: false,
        error: "Impossible de déterminer une consommation annuelle fiable à partir de cette facture. Veuillez saisir votre consommation manuellement.",
        nom,
        adresse,
        conso: null,
      });
    }

    return NextResponse.json({ success: true, nom, adresse, conso });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      console.error("[parse-bill] Timeout lors de l'analyse du document.");
      return jsonError("Le délai d'analyse a été dépassé. Le document est peut-être trop volumineux.", 504);
    }

    console.error("[parse-bill] Exception serveur non gérée:", error?.message || error);
    return jsonError("Une erreur inattendue est survenue lors de l'analyse de la facture.", 500);
  }
}
