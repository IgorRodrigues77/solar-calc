import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY non configurée sur Vercel." },
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

    // Endpoint REST oficial v1beta do Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Vous êtes un moteur OCR expert en extraction de factures d'énergie françaises (EDF, TotalEnergies, Engie, Enedis).
Analysez le document fourni et retournez STRICTEMENT un JSON valide avec cette structure exacte :
{
  "nom": string ou null (Nom et prénom complet du titulaire),
  "adresse": string ou null (Adresse complète du lieu de consommation avec numéro, voie, code postal et ville),
  "conso": number ou null (Consommation annuelle totale en kWh ou CAR si explicitement mentionnée)
}
Ne générez AUCUN texte en dehors du JSON. Si une information est absente, mettez null.`;

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
      console.error("Gemini API Error:", errorText);
      return NextResponse.json(
        { error: `Erreur API (${response.status}): ${errorText.slice(0, 150)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Sanitização para extrair somente o bloco JSON
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return NextResponse.json({
      nom: result.nom || null,
      adresse: result.adresse || null,
      conso: typeof result.conso === "number" ? result.conso : null,
    });
  } catch (error: any) {
    console.error("Server Crash Handled:", error);
    return NextResponse.json(
      { error: error?.message || "Erreur interne lors du traitement du fichier." },
      { status: 500 }
    );
  }
}