import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Clé API non configurée dans l'environnement." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");
    const mimeType = file.type && file.type.includes("pdf") ? "application/pdf" : "image/jpeg";

    const ai = new GoogleGenAI({ apiKey });

    // Chamada configurada com o modelo gemini-3.6-flash
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
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
              text: `Vous êtes un système d'extraction OCR de haute précision spécialisé dans les factures d'énergie en France (EDF, Engie, TotalEnergies, Enedis).

Analysez rigoureusement le document fourni et extrayez :
1. "nom": Le nom et prénom du titulaire du contrat ou client. Si introuvable, retournez null.
2. "adresse": L'adresse physique exacte du lieu de consommation (numéro, voie, code postal et ville). Si introuvable, retournez null.
3. "conso": La consommation annuelle en kWh explicitement indiquée (CAR - Consommation Annuelle de Référence, ou total annuel). Si la facture n'indique pas de consommation annuelle explicite, retournez null. NE PAS INVENTER de valeur.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nom: { type: Type.STRING, nullable: true },
            adresse: { type: Type.STRING, nullable: true },
            conso: { type: Type.INTEGER, nullable: true },
          },
          required: ["nom", "adresse", "conso"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");

    return NextResponse.json({
      nom: parsed.nom ?? null,
      adresse: parsed.adresse ?? null,
      conso: parsed.conso ?? null,
    });
  } catch (error: any) {
    console.error("Erreur Gemini SDK:", error);
    return NextResponse.json(
      { error: error?.message || "Erreur lors du traitement du document par l'IA." },
      { status: 500 }
    );
  }
}