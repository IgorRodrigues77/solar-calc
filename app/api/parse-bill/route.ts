import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY non configurée." },
        { status: 500 }
      );
    }

    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Aucun texte extrait du document." },
        { status: 400 }
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Vous êtes un système OCR d'extraction de factures d'énergie françaises (EDF, TotalEnergies, Engie, Enedis).
Analysez le texte suivant issu d'une facture et extrayez STRICTEMENT un objet JSON valide :
{
  "nom": string ou null,
  "adresse": string ou null,
  "conso": number ou null
}

Règles :
1. "nom" : nom et prénom du titulaire (ex: PIERRE BOKOBZA). Si absent, null.
2. "adresse" : adresse physique complète du lieu de consommation (rue, code postal, ville). Si absent, null.
3. "conso" : consommation annuelle en kWh (CAR ou total annuel). Si absent, null.
Ne renvoyez RIEN d'autre que l'objet JSON.

Texte de la facture :
"""
${text.slice(0, 10000)}
"""`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Erreur API: ${err.slice(0, 100)}` }, { status: 500 });
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const result = JSON.parse(rawJson);

    return NextResponse.json({
      nom: result.nom || null,
      adresse: result.adresse || null,
      conso: typeof result.conso === "number" ? result.conso : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erreur interne" },
      { status: 500 }
    );
  }
}