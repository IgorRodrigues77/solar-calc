import { NextResponse } from "next/server";

export const maxDuration = 30;

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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const promptText = `Analysez cette facture d'électricité française. Extrayez les 3 valeurs suivantes au format JSON pur uniquement :
{
  "nom": "Nom et prénom du titulaire",
  "adresse": "Adresse du lieu de consommation (rue, code postal, ville)",
  "conso": 3700
}
Pour 'conso', extrayez la consommation annuelle en kWh (ou divisez le montant TTC annuel par 0.25). Renvoyez uniquement l'objet JSON.`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        },
      }),
    });

    if (!response.ok) {
      const errDetail = await response.text();
      console.error("Détail Erreur Google API:", errDetail);
      return NextResponse.json(
        { error: `Google API Error (${response.status}): ${errDetail.slice(0, 180)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const result = JSON.parse(rawJson);

    return NextResponse.json({
      nom: result.nom || "Client Particulier",
      adresse: result.adresse || "",
      conso: typeof result.conso === "number" ? result.conso : 4800,
    });
  } catch (error: any) {
    console.error("Erreur serveur:", error);
    return NextResponse.json(
      { error: error?.message || "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}