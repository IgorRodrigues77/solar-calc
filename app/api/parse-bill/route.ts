import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Clé API non configurée." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || "application/pdf";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const prompt = `Vous êtes un système OCR d'extraction de factures d'énergie en France (EDF, TotalEnergies, Engie, Enedis).
Extrayez ces 3 informations du document sous forme de JSON strict :
{
  "nom": string ou null,
  "adresse": string ou null,
  "conso": number ou null
}
Règles :
1. "nom" : nom et prénom complets du titulaire.
2. "adresse" : adresse complète du lieu de consommation (rue, code postal et ville).
3. "conso" : consommation annuelle réelle en kWh (CAR ou total annuel).
Ne renvoyez RIEN d'autre que l'objet JSON.`;

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
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Erreur API Google (${response.status}): ${errorText.slice(0, 150)}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return NextResponse.json({
      nom: result.nom || null,
      adresse: result.adresse || null,
      conso: typeof result.conso === "number" ? result.conso : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erreur lors du traitement du fichier." },
      { status: 500 }
    );
  }
}