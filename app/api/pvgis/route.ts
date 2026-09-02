import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 20;

const PVGIS_BASE_URL = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc";
const REQUEST_TIMEOUT_MS = 15_000;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function parseFiniteNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = parseFiniteNumber(searchParams.get("lat"));
    const lon = parseFiniteNumber(searchParams.get("lon"));
    const peakpower = parseFiniteNumber(searchParams.get("peakpower"));

    if (lat === null || lat < -90 || lat > 90) {
      return errorResponse("Latitude invalide.", 400);
    }

    if (lon === null || lon < -180 || lon > 180) {
      return errorResponse("Longitude invalide.", 400);
    }

    if (peakpower === null || peakpower <= 0 || peakpower > 1000) {
      return errorResponse("Puissance photovoltaïque invalide.", 400);
    }

    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      peakpower: String(peakpower),
      loss: "14",
      optimalinclination: "1",
      outputformat: "json",
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${PVGIS_BASE_URL}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      const rawText = await response.text();

      if (!response.ok) {
        console.error(`[api/pvgis] PVGIS HTTP ${response.status}:`, rawText.slice(0, 500));

        let detail = "";
        try {
          const parsed = JSON.parse(rawText);
          detail = typeof parsed?.message === "string" ? parsed.message : "";
        } catch {
          // Réponse non JSON : on garde un message générique côté client.
        }

        return errorResponse(
          detail
            ? `Le service PVGIS a refusé la requête : ${detail}`
            : `Le service PVGIS a répondu avec le code HTTP ${response.status}.`,
          response.status >= 400 && response.status < 500 ? response.status : 502,
        );
      }

      let data: unknown;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error("[api/pvgis] Réponse PVGIS non JSON:", rawText.slice(0, 500));
        return errorResponse("Le service PVGIS a renvoyé une réponse invalide.", 502);
      }

      const annualYield =
        typeof data === "object" && data !== null
          ? (data as { outputs?: { totals?: { fixed?: { E_y?: unknown } } } })?.outputs?.totals?.fixed?.E_y
          : undefined;

      if (typeof annualYield !== "number" || !Number.isFinite(annualYield) || annualYield <= 0) {
        console.error("[api/pvgis] Production annuelle absente ou invalide:", annualYield);
        return errorResponse("PVGIS n'a pas retourné de production annuelle exploitable.", 502);
      }

      return NextResponse.json(data, {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[api/pvgis] Timeout PVGIS");
      return errorResponse("Le service PVGIS met trop de temps à répondre. Réessayez.", 504);
    }

    console.error("[api/pvgis] Erreur serveur:", error);
    return errorResponse("Impossible de contacter le service PVGIS pour le moment.", 502);
  }
}
