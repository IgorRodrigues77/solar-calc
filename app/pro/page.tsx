"use client";

import Link from "next/link";
import { useState } from "react";

export default function ProLandingPage() {
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [commercialCount, setCommercialCount] = useState("1-5");
  const [monthlyStudies, setMonthlyStudies] = useState("10-30");
  const [currentTool, setCurrentTool] = useState("Logiciel spécialisé");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitDemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactEmail.trim()) return;
    const request = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
      created_at: new Date().toISOString(),
      companyName: companyName.trim(),
      contactEmail: contactEmail.trim(),
      commercialCount,
      monthlyStudies,
      currentTool,
    };
    const existing = JSON.parse(localStorage.getItem("solar_demo_requests") || "[]");
    localStorage.setItem("solar_demo_requests", JSON.stringify([request, ...existing].slice(0, 50)));
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar B2B */}
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white font-black text-xs">
              S
            </div>
            <span className="font-bold tracking-tight text-zinc-900 text-sm">
              SOLAR ENERGIE <span className="text-blue-600 font-semibold">PRO</span>
            </span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition"
            >
              ← Simulateur Particulier
            </Link>
            <a
              href="#demo"
              className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              Demander une démo
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero Section B2B */}
        <div className="max-w-3xl mb-16">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 mb-4">
            Solution SaaS pour Installateurs & Réseaux Solaires
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-zinc-950 tracking-tight leading-[1.15] mb-5">
            Préparez vos pré-études photovoltaïques plus rapidement avec un outil de chiffrage instantané.
          </h1>
          <p className="text-zinc-600 text-base sm:text-lg leading-relaxed mb-8">
            Importez la facture de votre client, préparez une pré-étude photovoltaïque, comparez plusieurs scénarios et générez un rapport professionnel à votre marque.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href="#demo"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition text-center text-sm shadow-sm"
            >
              Demander une démonstration →
            </a>
            <Link
              href="/"
              className="w-full sm:w-auto bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold px-6 py-3 rounded-xl transition text-center text-sm"
            >
              Tester le moteur de calcul
            </Link>
          </div>
        </div>

        {/* Workflow B2B */}
        <section className="mb-20">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block mb-2">Workflow</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
              Du PDF client au rapport en quelques étapes.
            </h2>
            <p className="text-sm text-zinc-500 mt-2">
              Réduisez la saisie répétitive avant le rendez-vous sans remplacer votre expertise technique.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-zinc-200 rounded-2xl p-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-4">Avant</p>
              <div className="space-y-2 text-sm text-zinc-600">
                {["Facture PDF reçue", "Lecture et saisie manuelles", "Calcul / PVGIS / mise en page", "Rapport client"].map((item, i) => (
                  <div key={item}>
                    <div className="rounded-xl bg-zinc-50 p-3">{item}</div>
                    {i < 3 && <div className="text-zinc-300 pl-4 py-1">↓</div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-950 text-white rounded-2xl p-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-4">Avec Solar Energie</p>
              <div className="space-y-2 text-sm">
                {["Import de la facture", "Données détectées et vérifiées", "PVGIS + comparaison des scénarios", "Rapport PDF à votre marque"].map((item, i) => (
                  <div key={item}>
                    <div className={`rounded-xl p-3 ${i === 3 ? "bg-blue-600 font-semibold" : "bg-white/10"}`}>{item}</div>
                    {i < 3 && <div className="text-zinc-500 pl-4 py-1">↓</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3 Pilares B2B */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5 font-bold">
              01
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-2">Chiffrage Express en RDV</h3>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
              Vos conseillers dimensionnent la puissance et le coût rapidement face au prospect, sans multiplier les saisies manuelles.
            </p>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5 font-bold">
              02
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-2">Rapport PDF White-Label</h3>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
              Exportez un rapport de pré-étude de 5 pages aux couleurs et au logo de votre entreprise, avec les coordonnées de contact configurées dans votre espace Pro.
            </p>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5 font-bold">
              03
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-2">Import de facture</h3>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
              Déposez une facture PDF pour récupérer automatiquement les informations disponibles et réduire la saisie avant la simulation.
            </p>
          </div>
        </div>

        {/* Formulário de Demonstração */}
        <section id="demo" className="max-w-xl mx-auto bg-white border border-zinc-200/80 rounded-2xl p-8 shadow-sm">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-zinc-950 tracking-tight mb-1.5">
              Demande de démonstration
            </h2>
            <p className="text-xs text-zinc-500">
              Montrez-nous comment vous préparez vos études aujourd'hui et découvrez le workflow proposé.
            </p>
          </div>

          {submitted ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center text-emerald-800 text-sm">
              ✓ Merci. Vos informations ont bien été enregistrées pour cette démonstration.
            </div>
          ) : (
            <form onSubmit={handleSubmitDemo} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Nom de votre entreprise
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Volt Solaire France"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Adresse e-mail professionnelle
                </label>
                <input
                  type="email"
                  required
                  placeholder="direction@entreprise.fr"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Taille de l&apos;équipe commerciale
                </label>
                <select
                  value={commercialCount}
                  onChange={(e) => setCommercialCount(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                >
                  <option value="1-5">1 à 5 commerciaux</option>
                  <option value="6-15">6 à 15 commerciaux</option>
                  <option value="15+">Plus de 15 commerciaux / Réseau</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Nombre d'études par mois
                  </label>
                  <select
                    value={monthlyStudies}
                    onChange={(e) => setMonthlyStudies(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                  >
                    <option>1-10</option>
                    <option>10-30</option>
                    <option>30-100</option>
                    <option>100+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Outil utilisé aujourd'hui
                  </label>
                  <select
                    value={currentTool}
                    onChange={(e) => setCurrentTool(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                  >
                    <option>Excel</option>
                    <option>PVGIS</option>
                    <option>Logiciel spécialisé</option>
                    <option>Manuellement</option>
                    <option>Autre</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition text-sm shadow-sm cursor-pointer"
              >
                Planifier une présentation
              </button>
            </form>
          )}
        </section>
      </main>

      {/* Rodapé */}
      <footer className="border-t border-zinc-200 bg-white py-10 mt-20 text-xs text-zinc-400 text-center">
        <p className="font-medium text-zinc-700 mb-1">
          SOLAR ENERGIE PRO • Plateforme SaaS d&apos;aide à la vente photovoltaïque
        </p>
        <p className="text-zinc-400">
          Réservé aux professionnels du secteur de l&apos;énergie et installateurs qualifiés.
        </p>
      </footer>
    </div>
  );
}