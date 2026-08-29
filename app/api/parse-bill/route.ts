import { NextResponse } from "next/server";
import pdf from "pdf-parse";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const data = await pdf(buffer);
    const text = data.text;

    // 1. Extração do Nome do Titular
    let nom = "";
    const nameMatch = text.match(/(?:Nom du client|Titulaire du compte|Titulaire du contrat)\s*:\s*([^\n\r]+)/i) ||
                      text.match(/(?:M\.|Mme|Monsieur|Madame)\s+([A-ZÀ-ÿ\s\-]{3,35})/i);
    if (nameMatch && nameMatch[1]) {
      nom = nameMatch[1].trim().replace(/\s+/g, " ");
    }

    // 2. Extração do Endereço
    let adresse = "";
    const addrMatch = text.match(/Lieu de consommation\s*:\s*([\s\S]*?)(?:Référence|N°|Point|$)/i) ||
                      text.match(/(\d{1,4}\s+(?:RUE|AVENUE|BOULEVARD|BD|CHEMIN|ROUTE|VOIE|PLACE)[\s\S]*?\d{5}\s+[A-Za-zÀ-ÿ\-]+)/i);
    if (addrMatch && addrMatch[1]) {
      adresse = addrMatch[1].replace(/[\n\r]+/g, ", ").replace(/\s+/g, " ").trim();
    }

    // 3. Extração do Consumo Anual (CAR / kWh)
    let conso = 0;
    const kwhMatches = [...text.matchAll(/(\d{1,2}[\s.]?\d{3})\s*kWh/gi)];
    if (kwhMatches.length > 0) {
      const lastKwh = kwhMatches[kwhMatches.length - 1][1];
      conso = parseInt(lastKwh.replace(/[\s.]/g, ""), 10);
    } else {
      // Cálculo por valor financeiro TTC caso não ache o CAR direto
      const ttcMatch = text.match(/Total\s+TTC\D*(\d{2,4}[,\.]\d{2})/i);
      if (ttcMatch && ttcMatch[1]) {
        const val = parseFloat(ttcMatch[1].replace(",", "."));
        conso = Math.round(val / 0.25);
      }
    }

    return NextResponse.json({ nom, adresse, conso });
  } catch (error) {
    console.error("Erreur parsing PDF:", error);
    return NextResponse.json({ error: "Erreur lecture PDF" }, { status: 500 });
  }
}