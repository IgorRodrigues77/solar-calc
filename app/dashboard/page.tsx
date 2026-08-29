"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface ProjetSolaire {
  id: string | number;
  created_at: string;
  nom: string;
  email: string;
  telephone?: string;
  adresse?: string;
  region?: string;
  puissance_kw: number;
  economie_annuelle: number;
  gain_20ans: number;
}

export default function DashboardProjets() {
  const [projets, setProjets] = useState<ProjetSolaire[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/leads");
        if (res.ok) {
          const data = await res.json();
          setProjets(data || []);
        }
      } catch (err) {
        console.error("Erreur de chargement:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProjects();
  }, []);

  const filteredProjets = projets.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.nom?.toLowerCase().includes(q) ||
      p.adresse?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white font-black text-xs">
              S
            </div>
            <span className="font-bold tracking-tight text-zinc-900 text-sm">
              SOLAR ENERGIE <span className="text-blue-600 font-semibold">| Tableau de Bord</span>
            </span>
          </Link>
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-sm"
            >
              + Nouvelle étude
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Header da Página */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-blue-600 font-semibold block mb-1">
              Gestion Commerciale
            </span>
            <h1 className="text-3xl font-extrabold text-zinc-950 tracking-tight">
              Mes Études Photovoltaïques
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Consultez et retrouvez l&apos;ensemble des dossiers chiffrés pour vos clients.
            </p>
          </div>

          {/* Busca Rápida */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Rechercher un client, ville..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
            />
          </div>
        </div>

        {/* Listagem de Cards de Projetos */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-zinc-400 font-mono">
            Chargement des études en cours...
          </div>
        ) : filteredProjets.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 mx-auto mb-3 text-lg font-bold">
              📁
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-1">Aucun projet enregistré</h3>
            <p className="text-xs text-zinc-500 mb-6">
              Les simulations réalisées avec nom et e-mail s&apos;afficheront automatiquement ici.
            </p>
            <Link
              href="/"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition inline-block shadow-sm"
            >
              Créer un premier pré-dimensionnement
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjets.map((p) => {
              const dateStr = p.created_at
                ? new Date(p.created_at).toLocaleDateString("fr-FR")
                : "28/08/2026";

              const paybackEstime =
                p.economie_annuelle > 0
                  ? (
                      (p.puissance_kw === 3 ? 7500 : p.puissance_kw === 6 ? 13000 : 18000) /
                      p.economie_annuelle
                    ).toFixed(1)
                  : "N/A";

              return (
                <div
                  key={p.id}
                  className="bg-white border border-zinc-200/80 hover:border-blue-300 rounded-2xl p-6 shadow-sm transition group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-base font-bold text-zinc-900 tracking-tight group-hover:text-blue-600 transition">
                        {p.nom || "Client Particulier"}
                      </h2>
                      <p className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-[200px]">
                        {p.adresse || p.region || "Île-de-France"}
                      </p>
                    </div>
                    <span className="bg-zinc-950 text-white font-mono text-xs font-bold px-2.5 py-1 rounded-lg">
                      {p.puissance_kw} kWc
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-3 border-t border-b border-zinc-100 my-4 text-xs font-mono">
                    <div className="bg-zinc-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-zinc-400 font-sans block">Économies</span>
                      <span className="font-bold text-blue-600">~{p.economie_annuelle} €/an</span>
                    </div>
                    <div className="bg-zinc-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-zinc-400 font-sans block">Retour ROI</span>
                      <span className="font-bold text-zinc-900">{paybackEstime} ans</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-zinc-400 pt-1">
                    <span>{dateStr}</span>
                    <span className="text-blue-600 font-medium group-hover:underline">
                      Consulter →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}