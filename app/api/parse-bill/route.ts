import { NextResponse } from "next/server";
import zlib from "zlib";

function extractTextFromPdfBuffer(buffer: Buffer): string {
  let fullText = "";

  // 1. Tenta extrair texto de streams descomprimidas zlib
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  while ((match = streamRegex.exec(buffer.toString("latin1"))) !== null) {
    try {
      const streamData = Buffer.from(match[1], "latin1");
      const decompressed = zlib.inflateSync(streamData).toString("latin1");
      fullText += " " + decompressed;
    } catch {
      fullText += " " + match[1];
    }
  }

  // 2. Extrai caracteres literais entre parênteses típicos de comandos PDF (ex: (M. PIERRE BOKOBZA)Tj)
  const textMatches = fullText.match(/\(([^()]+)\)/g);
  if (textMatches) {
    fullText = textMatches.map((t) => t.slice(1, -1)).join(" ");
  }

  // Fallback para o buffer bruto caso a estrutura seja direta
  if (fullText.trim().length < 50) {
    fullText = buffer.toString("latin1").replace(/[^\x20-\x7E\xC0-\xFF]/g, " ");
  }

  return fullText.replace(/\s+/g, " ");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = extractTextFromPdfBuffer(buffer);

    // 1. Extração do Titular / Nome do Cliente
    let nom = "";
    const nameMatch =
      text.match(/Nom du client\s*:?\s*([A-Za-zÀ-ÿ\s.\-]{3,40})/i) ||
      text.match(/Titulaire du compte\s*:?\s*([A-Za-zÀ-ÿ\s.\-]{3,40})/i) ||
      text.match(/Titulaire du contrat\s*:?\s*([A-Za-zÀ-ÿ\s.\-]{3,40})/i) ||
      text.match(/(?:M\.|Mme|Monsieur|Madame)\s+([A-ZÀ-ÿ\s\-]{3,35})/);

    if (nameMatch && nameMatch[1]?.trim().length > 2) {
      nom = nameMatch[1].trim();
      if (!nom.toLowerCase().startsWith("m.") && !nom.toLowerCase().startsWith("mme")) {
        nom = "M. " + nom;
      }
    } else {
      nom = "Client Particulier";
    }

    // 2. Extração do Endereço (rua, código postal francês ou belga e cidade)
    let adresse = "";
    const addrMatch =
      text.match(/Lieu de consommation\s*:?\s*([A-Za-z0-9\s,À-ÿ\-]{8,80})/i) ||
      text.match(/(\d{1,4}\s+(?:RUE|AVENUE|BOULEVARD|BD|CHEMIN|ROUTE|VOIE|PLACE)[A-Za-z0-9\s,À-ÿ\-]+(?:\d{4,5})\s+[A-Za-zÀ-ÿ\-]+)/i);

    if (addrMatch && addrMatch[1]?.trim().length > 6) {
      adresse = addrMatch[1].trim();
    }

    // 3. Extração do Consumo Anual (kWh) ou conversão por Total da Fatura
    let conso = 0;
    const kwhMatches = [...text.matchAll(/(\d{3,5})\s*kWh/gi)];
    const yearKwh = text.match(/juil-\d{2}\s*(\d{3,5})/i) || text.match(/CAR\D*(\d{3,5})/i);
    const ttcMatch =
      text.match(/Total\s+TTC\D*(\d{2,4}[,\.]\d{2})/i) ||
      text.match(/Electricit[^\d]*(\d{2,4}[,\.]\d{2})/i);

    if (yearKwh && parseInt(yearKwh[1], 10) > 400) {
      conso = parseInt(yearKwh[1], 10);
    } else if (kwhMatches.length > 0) {
      const last = kwhMatches[kwhMatches.length - 1][1];
      conso = parseInt(last, 10);
    } else if (ttcMatch && ttcMatch[1]) {
      const val = parseFloat(ttcMatch[1].replace(",", "."));
      conso = Math.round(val / 0.25);
    } else {
      conso = 4800;
    }

    return NextResponse.json({ nom, adresse, conso });
  } catch (error) {
    console.error("Erreur parsing PDF:", error);
    return NextResponse.json({ error: "Erreur lecture PDF" }, { status: 500 });
  }
}