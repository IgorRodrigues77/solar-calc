"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface ProjetSolaire {
  id: string;
  created_at: string;
  nom: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  region?: string;
  puissance_kw: number;
  economie_annuelle: number;
  gain_20ans: number;
  productible?: number;
  conso_annuelle?: number;
}

export default function DashboardProjets() {
  const [projets, setProjets] = useState<ProjetSolaire[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("solar_projects") || "[]");
      setProjets(Array.isArray(saved) ? saved : []);
    } catch (err) {
      console.error("Erreur de chargement des études locales:", err);
      setProjets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filteredProjets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return projets;
    return projets.filter((p) =>
      [p.nom, p.adresse, p.email, p.region].some((value) => value?.toLowerCase().includes(q))
    );
  }, [projets, searchTerm]);

  const deleteProject = (id: string) => {
    const next = projets.filter((p) => p.id !== id);
    setProjets(next);
    localStorage.setItem("solar_projects", JSON.stringify(next));
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans antialiased">
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs shrink-0">S</div>
            <span className="font-bold tracking-tight text-zinc-900 text-sm truncate">
              SOLAR ENERGIE <span className="text-blue-600 font-semibold">| Espace Pro</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/settings" className="hidden sm:inline-flex text-xs font-semibold text-zinc-600 hover:text-zinc-900 px-3 py-2 rounded-xl transition">
              Ma société
            </Link>
            <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm">
              + Nouvelle étude
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 sm:py-12">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block mb-2">Espace Pro</span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">Mes études photovoltaïques</h1>
            <p className="text-zinc-500 text-sm mt-2 max-w-2xl">
              Retrouvez les pré-études enregistrées sur cet appareil et relancez rapidement un nouveau projet.
            </p>
          </div>
          <div className="w-full lg:w-80">
            <label className="sr-only" htmlFor="search-projects">Rechercher</label>
            <input
              id="search-projects"
              type="search"
              placeholder="Rechercher un client, une ville..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4">
            <span className="text-xs text-zinc-500">Études enregistrées</span>
            <div className="text-2xl font-black font-mono mt-1">{projets.length}</div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4">
            <span className="text-xs text-zinc-500">Puissance totale étudiée</span>
            <div className="text-2xl font-black font-mono mt-1">{projets.reduce((sum, p) => sum + (Number(p.puissance_kw) || 0), 0).toLocaleString("fr-FR")} <span className="text-xs text-zinc-400">kWc</span></div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4">
            <span className="text-xs text-zinc-500">Économies annuelles estimées</span>
            <div className="text-2xl font-black text-blue-600 font-mono mt-1">{projets.reduce((sum, p) => sum + (Number(p.economie_annuelle) || 0), 0).toLocaleString("fr-FR")} €</div>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center text-sm text-zinc-400">Chargement des études...</div>
        ) : filteredProjets.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center max-w-2xl mx-auto shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 mx-auto mb-4 text-lg">▣</div>
            <h3 className="text-lg font-bold text-zinc-900 mb-1">
              {projets.length ? "Aucune étude ne correspond à votre recherche" : "Aucune étude enregistrée"}
            </h3>
            <p className="text-sm text-zinc-500 mb-6">
              {projets.length ? "Modifiez votre recherche ou créez une nouvelle étude." : "Les études réalisées depuis ce navigateur apparaîtront ici."}
            </p>
            <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition inline-flex">
              Créer une étude
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProjets.map((p) => {
              const cost = p.puissance_kw === 3 ? 7500 : p.puissance_kw === 6 ? 13000 : p.puissance_kw === 9 ? 18000 : p.puissance_kw * 2166.67;
              const roi = p.economie_annuelle > 0 ? (cost / p.economie_annuelle).toFixed(1) : "N/A";
              return (
                <article key={p.id} className="bg-white border border-zinc-200/80 hover:border-blue-300 rounded-2xl p-6 shadow-sm transition">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-zinc-900 truncate">{p.nom || "Client particulier"}</h2>
                      <p className="text-xs text-zinc-400 mt-1 truncate">{p.adresse || p.region || "Adresse non renseignée"}</p>
                    </div>
                    <span className="bg-zinc-950 text-white font-mono text-xs font-bold px-2.5 py-1.5 rounded-lg shrink-0">{p.puissance_kw} kWc</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-4 mt-4 border-y border-zinc-100 text-xs">
                    <div className="bg-zinc-50 rounded-xl p-3">
                      <span className="text-[10px] text-zinc-400 block">Économies</span>
                      <span className="font-bold text-blue-600 font-mono">~{p.economie_annuelle.toLocaleString("fr-FR")} €/an</span>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-3">
                      <span className="text-[10px] text-zinc-400 block">Temps de retour</span>
                      <span className="font-bold text-zinc-900 font-mono">{roi} ans</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-3 text-[11px] text-zinc-400">
                    <span>{new Date(p.created_at).toLocaleDateString("fr-FR")}</span>
                    <button type="button" onClick={() => deleteProject(p.id)} className="text-zinc-500 hover:text-rose-600 transition">
                      Supprimer
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
