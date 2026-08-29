"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function CompanySettings() {
  const [companyName, setCompanyName] = useState("");
  const [logoBase64, setLogoBase64] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [siret, setSiret] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("solar_company_config");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCompanyName(data.companyName || "");
        setLogoBase64(data.logoBase64 || "");
        setTelephone(data.telephone || "");
        setEmail(data.email || "");
        setWebsite(data.website || "");
        setAddress(data.address || "");
        setSiret(data.siret || "");
        setPrimaryColor(data.primaryColor || "#2563eb");
      } catch (e) {
        console.error("Erreur de lecture de la configuration", e);
      }
    }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoBase64(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const config = {
      companyName,
      logoBase64,
      telephone,
      email,
      website,
      address,
      siret,
      primaryColor,
    };
    localStorage.setItem("solar_company_config", JSON.stringify(config));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

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
              SOLAR ENERGIE <span className="text-zinc-400 font-normal">| Paramètres Pro</span>
            </span>
          </Link>
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 px-3 py-1.5 transition"
            >
              ← Retour au Simulateur
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <span className="text-xs font-mono uppercase tracking-wider text-blue-600 font-semibold block mb-1">
            Personnalisation White-Label
          </span>
          <h1 className="text-3xl font-extrabold text-zinc-950 tracking-tight">
            Profil de votre Entreprise
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Ces coordonnées apparaîtront automatiquement sur tous vos dossiers PDF d&apos;ingénierie.
          </p>
        </div>

        <form onSubmit={handleSave} className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Nom de l&apos;entreprise
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
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Numéro SIRET
              </label>
              <input
                type="text"
                placeholder="Ex: 849 123 456 00012"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Couleur principale de marque
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-zinc-300 p-0.5 cursor-pointer bg-white"
                />
                <span className="text-xs font-mono text-zinc-600">{primaryColor}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Adresse e-mail de contact
              </label>
              <input
                type="email"
                placeholder="contact@voltsolaire.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Téléphone commercial
              </label>
              <input
                type="tel"
                placeholder="01 23 45 67 89"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Site internet
              </label>
              <input
                type="text"
                placeholder="www.voltsolaire.fr"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Adresse du siège social
              </label>
              <input
                type="text"
                placeholder="10 Rue de la République, 75001 Paris"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Logo de l&apos;entreprise (PNG ou JPG)
              </label>
              <input
                type="file"
                accept="image/png, image/jpeg"
                onChange={handleLogoUpload}
                className="block w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-800 hover:file:bg-zinc-200 cursor-pointer"
              />
              {logoBase64 && (
                <div className="mt-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
                  <span className="text-xs text-zinc-600">Aperçu du logo chargé :</span>
                  <img src={logoBase64} alt="Logo" className="h-8 max-w-[120px] object-contain" />
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              {isSaved && <span className="text-emerald-600 font-semibold">✓ Modifications enregistrées avec succès</span>}
            </span>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold py-2.5 px-6 rounded-xl transition text-sm cursor-pointer shadow-sm"
            >
              Enregistrer la configuration
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}