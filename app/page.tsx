"use client";

import { useState } from "react";

export default function Home() {
  const [consoAnnuelle, setConsoAnnuelle] = useState<number>(4500); // kWh/an
  const [prixKwh, setPrixKwh] = useState<number>(0.25); // €/kWh (tarif moyen France)
  const [puissanceKw, setPuissanceKw] = useState<number>(3); // kWc installé
  const [coutInstallation, setCoutInstallation] = useState<number>(7500); // €

  // Estimativas: ~1100 kWh gerados por kWc/ano na França
  const productionEstimee = puissanceKw * 1100;
  const factureActuelle = consoAnnuelle * prixKwh;
  // ~70% de autoconsumo direto
  const autoconsommation = Math.min(consoAnnuelle, productionEstimee * 0.7);
  const economieAnnuelle = autoconsommation * prixKwh;
  const payback = coutInstallation > 0 && economieAnnuelle > 0 
    ? (coutInstallation / economieAnnuelle).toFixed(1) 
    : "0";
  const roi20ans = (economieAnnuelle * 20) - coutInstallation;

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            Simulateur de Rentabilité Solaire ☀️
          </h1>
          <p className="mt-2 text-slate-600">
            Estimez vos économies d&apos;énergie et le retour sur investissement de votre installation photovoltaïque.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulário de Entradas */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Vos Paramètres</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Consommation annuelle (kWh/an)
                </label>
                <input
                  type="number"
                  value={consoAnnuelle}
                  onChange={(e) => setConsoAnnuelle(Number(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-amber-500 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Prix du kWh actuel (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={prixKwh}
                  onChange={(e) => setPrixKwh(Number(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-amber-500 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Puissance de l&apos;installation (kWc)
                </label>
                <select
                  value={puissanceKw}
                  onChange={(e) => {
                    const kw = Number(e.target.value);
                    setPuissanceKw(kw);
                    setCoutInstallation(kw === 3 ? 7500 : kw === 6 ? 12500 : 17500);
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-amber-500 focus:ring-amber-500 outline-none"
                >
                  <option value={3}>3 kWc (~6-8 panneaux)</option>
                  <option value={6}>6 kWc (~12-16 panneaux)</option>
                  <option value={9}>9 kWc (~18-24 panneaux)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Coût estimé du projet (€ TTC)
                </label>
                <input
                  type="number"
                  value={coutInstallation}
                  onChange={(e) => setCoutInstallation(Number(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-amber-500 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Painel de Resultados */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-6 text-amber-400">Résultats Estimés</h2>

              <div className="space-y-4">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Facture actuelle :</span>
                  <span className="font-semibold">{factureActuelle.toFixed(0)} € / an</span>
                </div>

                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Production estimée :</span>
                  <span className="font-semibold">{productionEstimee.toFixed(0)} kWh / an</span>
                </div>

                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Économie annuelle :</span>
                  <span className="font-semibold text-emerald-400">~{economieAnnuelle.toFixed(0)} € / an</span>
                </div>

                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Temps de retour (Payback) :</span>
                  <span className="font-semibold text-amber-400">{payback} ans</span>
                </div>

                <div className="flex justify-between pt-2">
                  <span className="text-slate-400">Gain net sur 20 ans :</span>
                  <span className="text-xl font-bold text-emerald-400">{roi20ans.toFixed(0)} €</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => alert("Fonctionnalité de contact prête à être connectée !")}
              className="mt-8 w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl transition duration-200"
            >
              Demander une étude personnalisée
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}