import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Decodifica os blocos de texto do PDF
    const rawText = buffer.toString("latin1");
    const cleanText = rawText.replace(/[^\x20-\x7E\xC0-\xFF]/g, " ");

    // 1. Extração do Titular / Nome do Cliente
    let nom = "";
    const nameMatch1 = cleanText.match(/Nom du client\s*:\s*([A-Za-zÀ-ÿ\s.\-]{3,40})/i);
    const nameMatch2 = cleanText.match(/Titulaire du compte\s*:\s*([A-Za-zÀ-ÿ\s.\-]{3,40})/i);
    const nameMatch3 = cleanText.match(/(?:M\.|Mme|Monsieur|Madame)\s+([A-ZÀ-ÿ\s\-]{3,35})/);

    if (nameMatch1 && nameMatch1[1]?.trim().length > 3) {
      nom = nameMatch1[1].trim().replace(/\s+/g, " ");
    } else if (nameMatch2 && nameMatch2[1]?.trim().length > 3) {
      nom = nameMatch2[1].trim().replace(/\s+/g, " ");
    } else if (nameMatch3 && nameMatch3[1]?.trim().length > 3) {
      nom = "M. " + nameMatch3[1].trim().replace(/\s+/g, " ");
    } else {
      nom = "Client Particulier";
    }

    // 2. Extração do Endereço (Lieu de consommation ou Código Postal Francês)
    let adresse = "";
    const addrMatch1 = cleanText.match(/Lieu de consommation\s*:\s*([A-Za-z0-9\s,À-ÿ\-]{10,80})/i);
    const addrMatch2 = cleanText.match(/(\d{1,4}\s+(?:RUE|AVENUE|BOULEVARD|BD|CHEMIN|ROUTE|VOIE|PLACE)[A-Za-z0-9\s,À-ÿ\-]+(?:75|91|92|93|94|95|77|78|13|69|33|31|59|06|44|34)\d{3}\s+[A-Za-zÀ-ÿ\-]+)/i);

    if (addrMatch2 && addrMatch2[1]?.trim().length > 8) {
      adresse = addrMatch2[1].trim().replace(/\s+/g, " ");
    } else if (addrMatch1 && addrMatch1[1]?.trim().length > 8) {
      adresse = addrMatch1[1].trim().replace(/\s+/g, " ");
    }

    // 3. Extração do Consumo Anual (CAR / kWh) ou Conversão por Fatura TTC
    let conso = 0;
    const kwhMatch = cleanText.match(/(\d{3,5})\s*kWh/i) || cleanText.match(/juil-\d{2}\s*(\d{3,5})/i);
    const ttcMatch = cleanText.match(/Total\s+TTC\D*(\d{2,4}[,\.]\d{2})/i) || cleanText.match(/Electricit[^\d]*(\d{2,4}[,\.]\d{2})/i);

    if (kwhMatch && parseInt(kwhMatch[1], 10) > 500) {
      conso = parseInt(kwhMatch[1], 10);
    } else if (ttcMatch && ttcMatch[1]) {
      const valEuros = parseFloat(ttcMatch[1].replace(",", "."));
      conso = Math.round(valEuros / 0.25);
    } else {
      conso = 4800;
    }

    return NextResponse.json({ nom, adresse, conso });
  } catch (error) {
    console.error("Erreur parsing PDF:", error);
    return NextResponse.json({ error: "Erreur lecture PDF" }, { status: 500 });
  }
}