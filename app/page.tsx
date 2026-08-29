"use client";

import { useState } from "react";
import jsPDF from "jspdf";

export default function Home() {
  const [region, setRegion] = useState("Île-de-France / Nord");
  const [puissanceKw, setPuissanceKw] = useState(3);
  const [consoAnnuelle, setConsoAnnuelle] = useState(4800);
  const [coutInstallation, setCoutInstallation] = useState(7500);

  const [nomClient, setNomClient] = useState("");
  const [emailClient, setEmailClient] = useState("");
  const [telClient, setTelClient] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const facteursRegion: Record<string, number> = {
    "Île-de-France / Nord": 950,
    "Grand-Est / Centre": 1050,
    "Sud-Ouest / Rhône-Alpes": 1250,
    "Provence / PACA / Occitanie": 1400,
  };

  const productible = facteursRegion[region] || 1000;
  const productionEstimee = puissanceKw * productible;
  const prixKwhAchat = 0.25;
  const partAutoconsommation = 0.7;
  const tarifRachatSurplus = 0.13;

  const economieAutoconsommation =
    Math.min(productionEstimee * partAutoconsommation, consoAnnuelle) * prixKwhAchat;
  const venteSurplus =
    Math.max(0, productionEstimee - productionEstimee * partAutoconsommation) *
    tarifRachatSurplus;
  const economieAnnuelle = economieAutoconsommation + venteSurplus;

  const payback =
    economieAnnuelle > 0
      ? (coutInstallation / economieAnnuelle).toFixed(1)
      : "N/A";
  const gain20ans = economieAnnuelle * 20 - coutInstallation;

  const handlePuissanceChange = (val: number) => {
    setPuissanceKw(val);
    if (val === 3) setCoutInstallation(7500);
    else if (val === 6) setCoutInstallation(13000);
    else if (val === 9) setCoutInstallation(18000);
  };

  const handleValidationAndPDF = async () => {
    if (!nomClient.trim() || !emailClient.trim()) {
      setErrorMsg("Veuillez renseigner votre nom et votre adresse e-mail.");
      return;
    }

    setErrorMsg("");
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nomClient,
          email: emailClient,
          telephone: telClient,
          region,
          puissance_kw: puissanceKw,
          economie_annuelle: Math.round(economieAnnuelle),
          gain_20ans: Math.round(gain20ans),
        }),
      });
      setSaveSuccess(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }

    // Geração do PDF
    const doc = new jsPDF();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 42, "F");

    doc.setTextColor(245, 158, 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SOLAR ENERGIE FRANCE", 14, 16);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("Installateur Qualifié RGE QualiPV  •  01 89 00 00 00  •  contact@solarenergie.fr", 14, 23);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("ÉTUDE DE FAISABILITÉ PHOTOVOLTAÏQUE", 14, 34);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225);
    doc.text(`Rapport émis le : ${new Date().toLocaleDateString("fr-FR")}`, 155, 34);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 48, 182, 30, 3, 3, "FD");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("INFORMATIONS DU BÉNÉFICIAIRE", 20, 56);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Nom / Titulaire : ${nomClient}`, 20, 64);
    doc.text(`E-mail : ${emailClient}`, 20, 71);
    doc.text(`Téléphone : ${telClient || "Non renseigné"}`, 105, 64);
    doc.text(`Secteur géographique : ${region}`, 105, 71);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 83, 182, 38, 3, 3, "FD");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("CONFIGURATION TECHNIQUE PROPOSÉE", 20, 91);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`• Puissance crête : ${puissanceKw} kWc`, 20, 100);
    doc.text(`• Consommation : ${consoAnnuelle} kWh/an`, 20, 108);
    doc.text(`• Production annuelle : ${Math.round(productionEstimee)} kWh/an`, 105, 100);
    doc.text(`• Investissement indicatif : ${coutInstallation} € TTC`, 105, 108);

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, 127, 56, 30, 3, 3, "FD");
    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("ÉCONOMIE ANNUELLE", 18, 135);
    doc.setFontSize(12.5);
    doc.text(`env. ${Math.round(economieAnnuelle)} € / an`, 18, 147);

    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(77, 127, 56, 30, 3, 3, "FD");
    doc.setTextColor(180, 83, 9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("RETOUR SUR INVEST.", 81, 135);
    doc.setFontSize(12.5);
    doc.text(`${payback} ans`, 81, 147);

    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(99, 102, 241);
    doc.roundedRect(140, 127, 56, 30, 3, 3, "FD");
    doc.setTextColor(67, 56, 202);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("GAIN ESTIMÉ (20 ANS)", 144, 135);
    doc.setFontSize(12.5);
    doc.text(`+${Math.round(gain20ans)} €`, 144, 147);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 164, 182, 48, 3, 3, "FD");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("ENGAGEMENTS & VALIDATION TECHNIQUE :", 20, 173);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("• Étude de faisabilité et vérification de structure toiture sous 48h.", 20, 182);
    doc.text("• Accompagnement démarches administratives : Mairie, Consuel et raccordement Enedis.", 20, 189);
    doc.text("• Éligibilité prime à l'autoconsommation et contrat de rachat EDF OA sur 20 ans.", 20, 196);
    doc.text("• Matériel certifié avec garantie de rendement linéaire jusqu'à 25 ans.", 20, 203);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Document établi à titre informatif selon les barèmes en vigueur. Non contractuel.", 14, 280);
    doc.text("Service Client : contact@solarenergie.fr | www.solarenergie.fr", 115, 280);

    doc.save(`etude-solaire-${nomClient.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl">☀️</span>
            <span className="font-bold tracking-tight text-white text-lg">
              SOLAR <span className="text-amber-400">ENERGIE</span>
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Certifié RGE QualiPV
            </span>
            <span className="text-xs text-slate-400 border border-slate-800 rounded-lg px-2.5 py-1">
              Barème 2026
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero Section Comercial */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-16 pb-12 border-b border-slate-800/80">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <span>☀️ SOLAR ENERGIE</span>
            </div>
            
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Votre projet solaire, <br />
              <span className="text-amber-400">chiffré en 60 secondes.</span>
            </h1>
            
            <p className="text-slate-400 text-sm sm:text-base max-w-xl leading-relaxed">
              Estimez votre production photovoltaïque, vos économies annuelles et votre temps de retour sur investissement selon les barèmes en vigueur.
            </p>

            <div className="pt-2">
              <a
                href="#simulateur"
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95 text-sm"
              >
                <span>Calculer mon projet gratuitement</span>
                <span>→</span>
              </a>
            </div>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Estimation personnalisée</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Résultats instantanés</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Étude PDF disponible</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-sm rounded-2xl bg-gradient-to-b from-slate-800/60 to-slate-900/90 p-5 border border-slate-700/60 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Aperçu de l&apos;Étude
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <p className="text-[11px] text-slate-400">Production estimée</p>
                  <p className="text-base font-bold text-white">4 500 kWh / an</p>
                </div>

                <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                  <p className="text-[11px] text-emerald-300">Économies estimées</p>
                  <p className="text-base font-bold text-emerald-400">~820 € / an</p>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <p className="text-[11px] text-slate-400">Temps de retour</p>
                  <p className="text-base font-bold text-amber-400">9.8 ans</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ancora e Grid do Formulário */}
        <div id="simulateur" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Lado Esquerdo: Formulário */}
          <div className="lg:col-span-7 space-y-6">
            {/* Bloco 1: Paramètres */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl backdrop-blur-sm space-y-6">
              <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                  1
                </span>
                <h2 className="text-base font-semibold text-white">Paramètres Techniques</h2>
              </div>

              {/* Cards de Potência */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2.5">
                  Puissance de l&apos;installation souhaitée
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { kw: 3, panels: "6-8 panneaux", desc: "Maison standard" },
                    { kw: 6, panels: "12-16 panneaux", desc: "Moyenne / Grande" },
                    { kw: 9, panels: "18-24 panneaux", desc: "Forte conso / PAC" },
                  ].map((item) => (
                    <button
                      key={item.kw}
                      type="button"
                      onClick={() => handlePuissanceChange(item.kw)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        puissanceKw === item.kw
                          ? "bg-amber-500/10 border-amber-500 text-white shadow-md shadow-amber-500/10"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm sm:text-base font-black ${puissanceKw === item.kw ? "text-amber-400" : "text-white"}`}>
                          {item.kw} kWc
                        </span>
                        {puissanceKw === item.kw && (
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-slate-300">{item.panels}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider de Consumo */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-slate-300">
                    Consommation électrique annuelle
                  </label>
                  <span className="text-xs font-bold text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {consoAnnuelle.toLocaleString("fr-FR")} kWh / an
                  </span>
                </div>
                <input
                  type="range"
                  min={2000}
                  max={15000}
                  step={100}
                  value={consoAnnuelle}
                  onChange={(e) => setConsoAnnuelle(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>2 000 kWh</span>
                  <span>8 000 kWh (Moyenne)</span>
                  <span>15 000 kWh</span>
                </div>
              </div>

              {/* Região e Custo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Région géographique
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
                  >
                    <option value="Île-de-France / Nord">Île-de-France / Nord (~950 kWh/kWc)</option>
                    <option value="Grand-Est / Centre">Grand-Est / Centre (~1050 kWh/kWc)</option>
                    <option value="Sud-Ouest / Rhône-Alpes">Sud-Ouest / Rhône-Alpes (~1250 kWh/kWc)</option>
                    <option value="Provence / PACA / Occitanie">Provence / PACA / Occitanie (~1400 kWh/kWc)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Coût indicatif (€ TTC)
                  </label>
                  <input
                    type="number"
                    value={coutInstallation}
                    onChange={(e) => setCoutInstallation(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Bloco 2: Coordonnées */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl backdrop-blur-sm">
              <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-4 mb-5">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                  2
                </span>
                <h2 className="text-base font-semibold text-white">Vos Coordonnées pour l&apos;Étude</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nom & Prénom <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Jean Dupont"
                    value={nomClient}
                    onChange={(e) => setNomClient(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Adresse E-mail <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="jean.dupont@exemple.fr"
                      value={emailClient}
                      onChange={(e) => setEmailClient(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      placeholder="06 12 34 56 78"
                      value={telClient}
                      onChange={(e) => setTelClient(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
                    ⚠️ {errorMsg}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Lado Direito: Resultados */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md sticky top-24 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Bilan Prévisionnel</h2>
                  <p className="text-xs text-slate-400">Projection financière personnalisée</p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Cycle 20 ans
                </span>
              </div>

              {/* Grid de Métricas Principais */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <p className="text-[11px] text-slate-400 mb-1">Production annuelle</p>
                  <p className="text-base font-bold text-white">{Math.round(productionEstimee)} kWh</p>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[11px] text-amber-300 mb-1">Temps de retour</p>
                  <p className="text-base font-bold text-amber-400">{payback} ans</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center">
                <div>
                  <p className="text-xs font-medium text-emerald-300">Économies estimées / an</p>
                  <p className="text-xs text-slate-400">Autoconsommation + revente</p>
                </div>
                <p className="text-xl font-black text-emerald-400">~{Math.round(economieAnnuelle)} €</p>
              </div>

              {/* Gráfico Simples de Rentabilidade Cumulativa */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <p className="text-xs font-semibold text-slate-300">Cumul des gains estimés</p>
                
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>5 ans</span>
                      <span className="text-slate-200 font-mono">+{Math.round(economieAnnuelle * 5)} €</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full w-1/4 rounded-full"></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>10 ans</span>
                      <span className="text-slate-200 font-mono">+{Math.round(economieAnnuelle * 10)} €</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full w-2/4 rounded-full"></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-emerald-400 font-semibold mb-1">
                      <span>20 ans (Net)</span>
                      <span className="font-mono">+{Math.round(gain20ans)} €</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full w-full rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botão de Download */}
              <div>
                <button
                  onClick={handleValidationAndPDF}
                  disabled={isSaving}
                  className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center space-x-2 text-sm cursor-pointer"
                >
                  <span>📄</span>
                  <span>{isSaving ? "Génération en cours..." : "Télécharger mon Étude (PDF)"}</span>
                </button>

                {saveSuccess && (
                  <p className="mt-3 text-xs text-center text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-2">
                    ✓ Demande enregistrée. Votre étude est en cours de téléchargement.
                  </p>
                )}

                <p className="mt-3 text-[11px] text-center text-slate-500">
                  🔒 Vos données restent confidentielles conformément au RGPD.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Profissional */}
      <footer className="border-t border-slate-900 bg-slate-950 py-10 mt-16 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span>☀️</span>
            <span className="font-semibold text-slate-300">SOLAR ENERGIE FRANCE</span>
            <span>—</span>
            <span>Solutions Photovoltaïques Certifiées</span>
          </div>
          <p className="text-center sm:text-right">
            Étude indicative basée sur les tarifs de rachat EDF OA et données météo 2026.
          </p>
        </div>
      </footer>
    </div>
  );
}