import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // Limite de 10 MB

interface BillExtractionResult {
  nom: string | null;
  adresse: string | null;
  conso: number | null;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.error("[parse-bill] ERREUR: GEMINI_API_KEY manquante dans les variables d'environnement.");
      return NextResponse.json(
        {
          success: false,
          error: "Service d'extraction temporairement indisponible (clé API non configurée).",
          nom: null,
          adresse: null,
          conso: null,
        },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucun fichier reçu.",
          nom: null,
          adresse: null,
          conso: null,
        },
        { status: 400 }
      );
    }

    // 1. Validação de tamanho
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Le fichier dépasse la taille maximale autorisée (10 Mo).",
          nom: null,
          adresse: null,
          conso: null,
        },
        { status: 400 }
      );
    }

    // 2. Validação de formato PDF
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json(
        {
          success: false,
          error: "Veuillez téléverser un document au format PDF valide.",
          nom: null,
          adresse: null,
          conso: null,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Le fichier téléversé est vide.",
          nom: null,
          adresse: null,
          conso: null,
        },
        { status: 400 }
      );
    }

    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    console.info(`[parse-bill] Fichier PDF reçu: ${file.name} (${Math.round(file.size / 1024)} Ko). Envoi à Gemini 3.7 Flash...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: "application/pdf",
                  data: base64Data,
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error(`[parse-bill] Erreur API Gemini (HTTP ${geminiRes.status}):`, errBody.slice(0, 200));
      return NextResponse.json(
        {
          success: false,
          error: "Échec de la communication avec le moteur d'analyse IA.",
          nom: null,
          adresse: null,
          conso: null,
        },
        { status: geminiRes.status }
      );
    }

    const geminiData = await geminiRes.json();
    const rawContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      console.warn("[parse-bill] Gemini a renvoyé une réponse sans contenu texte.");
      return NextResponse.json(
        {
          success: false,
          error: "Impossible d'extraire le contenu textuel de ce document.",
          nom: null,
          adresse: null,
          conso: null,
        },
        { status: 422 }
      );
    }

    // Parsing sécurisé du JSON
    let parsed: BillExtractionResult;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Format JSON non détecté dans la réponse IA");
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("[parse-bill] Erreur de décodage JSON:", parseErr);
      return NextResponse.json(
        {
          success: false,
          error: "Réponse du modèle non conforme au format attendu.",
          nom: null,
          adresse: null,
          conso: null,
        },
        { status: 500 }
      );
    }

    const nom = typeof parsed.nom === "string" && parsed.nom.trim().length > 0 ? parsed.nom.trim() : null;
    const adresse = typeof parsed.adresse === "string" && parsed.adresse.trim().length > 0 ? parsed.adresse.trim() : null;
    const conso = typeof parsed.conso === "number" && !isNaN(parsed.conso) && parsed.conso > 0 ? Math.round(parsed.conso) : null;

    console.info(`[parse-bill] Extraction réussie - Titulaire: ${nom ? "Oui" : "Non"}, Adresse: ${adresse ? "Oui" : "Non"}, Conso annuelle: ${conso !== null ? `${conso} kWh` : "Non déterminable"}`);

    if (conso === null) {
      return NextResponse.json({
        success: false,
        error: "Impossible de déterminer une consommation annuelle fiable à partir de cette facture. Veuillez saisir votre consommation manuellement.",
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
      console.error("[parse-bill] Timeout lors de l'analyse du document.");
      return NextResponse.json(
        {
          success: false,
          error: "Le délai d'analyse a été dépassé. Le document est peut-être trop volumineux.",
          nom: null,
          adresse: null,
          conso: null,
        },
        { status: 504 }
      );
    }

    console.error("[parse-bill] Exception serveur non gérée:", error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: "Une erreur inattendue est survenue lors de l'analyse de la facture.",
        nom: null,
        adresse: null,
        conso: null,
      },
      { status: 500 }
    );
  }
}