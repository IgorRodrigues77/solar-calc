import { NextResponse } from "next/server";

export const maxDuration = 30; // Permite tempo suficiente para processamento na Vercel

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé API non configurée" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || "application/pdf";

    // Chamada direta via REST API com timeout controlado
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s max

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `Vous êtes un extracteur expert de factures d'énergie françaises (EDF, TotalEnergies, Engie, Enedis).
Extrayez ces 3 informations du document sous forme de JSON strict :
{
  "nom": "Nom et prénom du titulaire (ex: PIERRE BOKOBZA)",
  "adresse": "Adresse complète du lieu de consommation (rue, code postal et ville)",
  "conso": 3736
}
Pour "conso", cherchez la consommation annuelle réelle en kWh (ou CAR). Si absent, divisez le montant TTC par 0.25. Donnez un entier.
Répondez UNIQUEMENT avec l'objet JSON.`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
              { text: promptText },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.1,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error("Erreur Gemini API:", errText);
      return NextResponse.json({ error: "Échec de l'analyse IA" }, { status: response.status });
    }

    const data = await response.json();
    const jsonString = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const result = JSON.parse(jsonString);

    return NextResponse.json({
      nom: result.nom || "Client Particulier",
      adresse: result.adresse || "",
      conso: typeof result.conso === "number" ? result.conso : 4800,
    });
  } catch (error: any) {
    console.error("Erreur générale parsing:", error?.message || error);
    return NextResponse.json(
      { error: error?.name === "AbortError" ? "Délai d'attente dépassé (timeout)" : "Erreur de traitement" },
      { status: 500 }
    );
  }
}