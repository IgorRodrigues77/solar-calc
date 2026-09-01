export interface SolarScenario {
  kw: number;
  cost: number;
  prod: number;
  autoconsoKwh: number;
  surplusKwh: number;
  tauxAutoconsommation: number;
  ecoAutoconso: number;
  revenuSurplus: number;
  ecoAnnuelle: number;
  roi: string;
  gain20: number;
  co2: number;
}

export const DEFAULT_PRICES = {
  purchase: 0.25,
  surplus: 0.13,
};

export const DEFAULT_INSTALLATION_COSTS: Record<number, number> = {
  3: 7500,
  6: 13000,
  9: 18000,
};

export function getInstallationCost(kw: number) {
  return DEFAULT_INSTALLATION_COSTS[kw] ?? kw * 2166.67;
}

export function getRecommendedPower(consumption: number) {
  if (consumption <= 4000) return 3;
  if (consumption <= 8000) return 6;
  return 9;
}

export function calculateSolarScenario(
  kw: number,
  productible: number,
  annualConsumption: number,
  customCost?: number
): SolarScenario {
  const cost = customCost ?? getInstallationCost(kw);
  const prod = Math.max(0, kw * productible);

  // Conservative MVP assumption: 70% of annual PV production is potentially
  // consumed on site, capped by annual electricity demand.
  const theoreticalAutoconso = prod * 0.70;
  const autoconsoKwh = Math.min(theoreticalAutoconso, Math.max(0, annualConsumption));
  const surplusKwh = Math.max(0, prod - autoconsoKwh);

  const ecoAutoconso = autoconsoKwh * DEFAULT_PRICES.purchase;
  const revenuSurplus = surplusKwh * DEFAULT_PRICES.surplus;
  const ecoAnnuelle = ecoAutoconso + revenuSurplus;

  const roiValue = ecoAnnuelle > 0 ? cost / ecoAnnuelle : Infinity;
  const roi = Number.isFinite(roiValue) ? roiValue.toFixed(1) : "N/A";

  // Simple constant-price projection for the MVP. This is explicitly labeled
  // as an estimate in the UI/PDF and should not be presented as a financial guarantee.
  const gain20 = ecoAnnuelle * 20 - cost;

  // Indicative avoided emissions factor used for a directional KPI only.
  const co2 = Math.round(prod * 0.05);

  const tauxAutoconsommation = prod > 0 ? (autoconsoKwh / prod) * 100 : 0;

  return {
    kw,
    cost,
    prod,
    autoconsoKwh,
    surplusKwh,
    tauxAutoconsommation,
    ecoAutoconso,
    revenuSurplus,
    ecoAnnuelle,
    roi,
    gain20,
    co2,
  };
}
