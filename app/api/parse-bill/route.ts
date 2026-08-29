import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export async function POST(req: Request) {
  try {
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
              text: `Vous êtes un extracteur expert de factures d'électricité françaises (EDF, TotalEnergies, Engie, Enedis).
Analysez le document joint et extrayez exactement ces 3 champs structurés au format JSON :
1. nom : Le nom complet du titulaire du contrat / client (ex: M. PIERRE BOKOBZA).
2. adresse : L'adresse complète du lieu de consommation (rue, code postal et ville. Ex: 35 RUE DE MAUBEUGE, 75009 PARIS).
3. conso : La consommation annuelle en kWh (recherchez le CAR, consommation annuelle de référence, ou le total annuel en kWh. Si absent, estimez via le montant TTC divisé par 0.25). Retournez uniquement l'entier.`,
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

    const result = JSON.parse(response.text || "{}");

    return NextResponse.json({
      nom: result.nom || "Client Particulier",
      adresse: result.adresse || "",
      conso: result.conso || 4800,
    });
  } catch (error) {
    console.error("Erreur parsing facture via IA:", error);
    return NextResponse.json(
      { error: "Impossible de lire la facture" },
      { status: 500 }
    );
  }
}