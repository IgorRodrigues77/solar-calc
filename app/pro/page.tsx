"use client";

import Link from "next/link";
import { useState } from "react";

export default function ProLandingPage() {
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [commercialCount, setCommercialCount] = useState("1-5");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitDemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !contactEmail) return;
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
            Accélérez vos ventes photovoltaïques avec un outil de chiffrage instantané.
          </h1>
          <p className="text-zinc-600 text-base sm:text-lg leading-relaxed mb-8">
            Équipez vos commerciaux d&apos;une application moderne pour dimensionner les projets en rendez-vous client et générer automatiquement des dossiers d&apos;ingénierie certifiés de 5 pages à votre marque.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href="#demo"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition text-center text-sm shadow-sm"
            >
              Demander un accès démo commercial →
            </a>
            <Link
              href="/"
              className="w-full sm:w-auto bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold px-6 py-3 rounded-xl transition text-center text-sm"
            >
              Tester le moteur de calcul
            </Link>
          </div>
        </div>

        {/* 3 Pilares B2B */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5 font-bold">
              01
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-2">Chiffrage Express en RDV</h3>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
              Vos conseillers dimensionnent la puissance et le coût en 60 secondes face au prospect, sans logiciel d&apos;ingénierie complexe.
            </p>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5 font-bold">
              02
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-2">Dossier PDF White-Label</h3>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
              Exportez des études de 5 pages aux couleurs et logos de votre entreprise intégrant vos barèmes de marge et garanties matérielles.
            </p>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5 font-bold">
              03
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-2">Capture de Leads Qualifiés</h3>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
              Intégrez le simulateur en widget sur votre site web pour collecter des coordonnées complètes avec données de consommation préalables.
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
              Découvrez comment déployer la plateforme auprès de votre force commerciale.
            </p>
          </div>

          {submitted ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center text-emerald-800 text-sm">
              ✓ Votre demande a été enregistrée. Notre équipe vous recontactera sous 24h ouvrées.
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