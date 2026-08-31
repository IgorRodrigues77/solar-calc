import React, { useState } from "react";
import { Info, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";

interface HypothesesProps {
  puissanceKw: number;
  consoAnnuelle: number;
  productionAnnuelle: number;
  productibleKwhKwc: number;
  coutTTC: number;
  primeAutoconsommation: number;
  economieAnnuelle: number;
  anneesROI: number;
  tauxAutoconso?: number;
  prixKwhReseau?: number;
  tarifReventeSurplus?: number;
}

export default function HypothesesCalcul({
  puissanceKw,
  consoAnnuelle,
  productionAnnuelle,
  productibleKwhKwc,
  coutTTC,
  primeAutoconsommation,
  economieAnnuelle,
  anneesROI,
  tauxAutoconso = 70, // 70% par défaut
  prixKwhReseau = 0.2516, // Tarif Bleu EDF TTC moyen
  tarifReventeSurplus = 0.13, // Tarif arrêté tarifaire EDF OA
}: HypothesesProps) {
  const [isOpen, setIsOpen] = useState(false);

  const investissementNet = coutTTC - primeAutoconsommation;
  const kwhAutoconsomme = Math.round(productionAnnuelle * (tauxAutoconso / 100));
  const kwhSurplus = Math.max(0, productionAnnuelle - kwhAutoconsomme);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8 transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">
              Hypothèses et Méthodologie de Calcul
            </h3>
            <p className="text-xs text-slate-500">
              Transparence sur les paramètres solaires, réglementaires et financiers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
          <span>{isOpen ? "Masquer les détails" : "Consulter les paramètres"}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-6 border-t border-slate-200 space-y-6 text-sm">
          {/* Section 1: Paramètres Techniques */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Modèle Technique & Gisement Solaire (PVGIS)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div>
                <span className="text-slate-500 text-xs block">Puissance crête installée</span>
                <span className="font-semibold text-slate-800">{puissanceKw} kWc</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Productible spécifique estimé</span>
                <span className="font-semibold text-slate-800">{productibleKwhKwc} kWh / kWc / an</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Facteur de pertes système</span>
                <span className="font-semibold text-slate-800">14 % (Norme PVGIS standard)</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Orientation / Inclinaison</span>
                <span className="font-semibold text-slate-800">Sud (Azimut 0°) / ~30° optimale</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Production totale annuelle</span>
                <span className="font-semibold text-slate-800 text-blue-600">{productionAnnuelle.toLocaleString("fr-FR")} kWh / an</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Dégradation des modules</span>
                <span className="font-semibold text-slate-800">0,5 % / an</span>
              </div>
            </div>
          </div>

          {/* Section 2: Répartition Énergétique */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Autoconsommation & Injection Réseau
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div>
                <span className="text-slate-500 text-xs block">Taux d&apos;autoconsommation moyen</span>
                <span className="font-semibold text-slate-800">{tauxAutoconso} %</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Énergie autoconsommée</span>
                <span className="font-semibold text-emerald-600">{kwhAutoconsomme.toLocaleString("fr-FR")} kWh / an</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Surplus injecté (EDF OA)</span>
                <span className="font-semibold text-amber-600">{kwhSurplus.toLocaleString("fr-FR")} kWh / an</span>
              </div>
            </div>
          </div>

          {/* Section 3: Paramètres Économiques et Aides */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-600"></span>
              Modèle Financier & Cadre Réglementaire Français
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div>
                <span className="text-slate-500 text-xs block">Coût d&apos;installation estimé (TTC)</span>
                <span className="font-semibold text-slate-800">{coutTTC.toLocaleString("fr-FR")} €</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Prime à l&apos;autoconsommation (EDF OA)</span>
                <span className="font-semibold text-emerald-600">- {primeAutoconsommation.toLocaleString("fr-FR")} €</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Investissement Net Client</span>
                <span className="font-bold text-slate-900">{investissementNet.toLocaleString("fr-FR")} €</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Prix d&apos;achat électricité réseau évité</span>
                <span className="font-semibold text-slate-800">{prixKwhReseau.toFixed(4)} € / kWh</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Tarif de rachat surplus (Arrêté CRE)</span>
                <span className="font-semibold text-slate-800">{tarifReventeSurplus.toFixed(2)} € / kWh</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Inflation énergétique projetée</span>
                <span className="font-semibold text-slate-800">3,0 % / an</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50/50 rounded-xl text-xs text-blue-800 border border-blue-100">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 text-blue-600" />
            <span>
              Calcul du retour sur investissement (ROI : <strong>{anneesROI.toFixed(1)} ans</strong>) déterminé par flux de trésorerie actualisés sur une durée de vie module de 25 ans.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}