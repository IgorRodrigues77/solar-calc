import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY non trouvée dans les variables d'environnement.");
      return NextResponse.json({ error: "Clé API non configurée" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");
    const mimeType = file.type || "application/pdf";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: `Vous êtes un extracteur expert de factures d'énergie en France.
Extrayez ces 3 informations précises au format JSON :
1. nom: nom et prénom du titulaire (ex: PIERRE BOKOBZA).
2. adresse: adresse du lieu de consommation (rue, code postal et ville).
3. conso: consommation annuelle totale en kWh (CAR ou estimée). Si absent, montant TTC / 0.25. Entier uniquement.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nom: { type: Type.STRING },
            adresse: { type: Type.STRING },
            conso: { type: Type.INTEGER },
          },
          required: ["nom", "adresse", "conso"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");

    return NextResponse.json({
      nom: parsed.nom || "Client Particulier",
      adresse: parsed.adresse || "",
      conso: parsed.conso || 4800,
    });
  } catch (error: any) {
    console.error("Détail erreur Gemini Vision:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Erreur de traitement IA" },
      { status: 500 }
    );
  }
}