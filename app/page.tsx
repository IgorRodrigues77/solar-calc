"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import Link from "next/link";

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);

  // Dados Técnicos
  const [region, setRegion] = useState("Île-de-France / Nord");
  const [puissanceKw, setPuissanceKw] = useState(3);
  const [consoAnnuelle, setConsoAnnuelle] = useState(4800);
  const [coutInstallation, setCoutInstallation] = useState(7500);

  // Dados do Lead
  const [nomClient, setNomClient] = useState("");
  const [emailClient, setEmailClient] = useState("");
  const [telClient, setTelClient] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Fatores de Cálculo
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
  const co2EviteKg = Math.round(productionEstimee * 0.05);

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
    const dateJour = new Date().toLocaleDateString("fr-FR");

    const renderFooter = (pageNumber: number) => {
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("SOLAR ENERGIE FRANCE • Étude Technique Prévisionnelle • Confidentiel", 14, 285);
      doc.text(`Page ${pageNumber} / 5`, 185, 285);
    };

    const renderHeader = (title: string, subtitle: string) => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 32, "F");

      doc.setTextColor(59, 130, 246);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("SOLAR ENERGIE FRANCE", 14, 13);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(title, 14, 23);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(subtitle, 150, 23);
    };

    // Página 1
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 297, "F");
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 6, 297, "F");

    doc.setTextColor(59, 130, 246);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SOLAR ENERGIE FRANCE", 25, 45);

    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Ingénierie & Solutions d'Autoconsommation Résidentielle", 25, 52);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("ÉTUDE DE FAISABILITÉ", 25, 110);
    doc.text("PHOTOVOLTAÏQUE", 25, 122);

    doc.setFontSize(11);
    doc.setTextColor(203, 213, 225);
    doc.setFont("helvetica", "normal");
    doc.text("Dimensionnement technique, rentabilité prévisionnelle & bilan carbone", 25, 134);

    doc.setFillColor(30, 41, 59);
    doc.setDrawColor(51, 65, 85);
    doc.roundedRect(25, 175, 160, 45, 4, 4, "FD");

    doc.setTextColor(59, 130, 246);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("BÉNÉFICIAIRE DE L'ÉTUDE", 32, 187);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10.5);
    doc.text(`Nom / Titulaire : ${nomClient}`, 32, 196);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Contact : ${emailClient}  |  ${telClient || "Non renseigné"}`, 32, 204);
    doc.text(`Secteur : ${region}`, 32, 212);

    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Date d'émission : ${dateJour}`, 25, 260);
    doc.text("Rapport d'audit préliminaire généré automatiquement", 25, 266);

    // Página 2
    doc.addPage();
    renderHeader("SYNTHÈSE DU PROJET", "Étape 1 sur 4");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("1. Caractéristiques Techniques de l'Installation", 14, 46);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 52, 182, 60, 3, 3, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("• Puissance crête sélectionnée :", 20, 64);
    doc.text("• Surface de toiture requise :", 20, 75);
    doc.text("• Estimation du gisement solaire :", 20, 86);
    doc.text("• Production annuelle estimée :", 20, 97);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`${puissanceKw} kWc (${puissanceKw === 3 ? "6-8" : puissanceKw === 6 ? "12-16" : "18-24"} modules)`, 100, 64);
    doc.text(`env. ${puissanceKw * 5} m2 de toiture`, 100, 75);
    doc.text(`${productible} kWh/kWc/an (${region})`, 100, 86);
    doc.setTextColor(16, 185, 129);
    doc.text(`${Math.round(productionEstimee)} kWh / an`, 100, 97);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("2. Bilan Écologique & Décarbonation", 14, 126);

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, 132, 182, 38, 3, 3, "FD");

    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("RÉDUCTION DE L'EMPREINTE CARBONE", 20, 142);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Grâce à la production décarbonée de votre centrale solaire, vous évitez :", 20, 151);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(5, 150, 105);
    doc.text(`env. ${co2EviteKg} kg de CO2 par an (soit ${(co2EviteKg * 20 / 1000).toFixed(1)} tonnes de CO2 évitées sur 20 ans).`, 20, 160);
    renderFooter(2);

    // Página 3
    doc.addPage();
    renderHeader("ANALYSE FINANCIÈRE", "Étape 2 sur 4");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Synthèse des Flux Économiques", 14, 46);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 54, 56, 35, 3, 3, "FD");
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("INVESTISSEMENT ESTIMÉ", 18, 64);
    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${coutInstallation} € TTC`, 18, 77);

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(77, 54, 56, 35, 3, 3, "FD");
    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("ÉCONOMIE ANNUELLE", 81, 64);
    doc.setFontSize(12.5);
    doc.text(`env. ${Math.round(economieAnnuelle)} €/an`, 81, 77);

    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(140, 54, 56, 35, 3, 3, "FD");
    doc.setTextColor(180, 83, 9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("RETOUR ESTIMÉ", 144, 64);
    doc.setFontSize(12.5);
    doc.text(`${payback} ans`, 144, 77);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Détail des Économies Annuelles Estimées :", 14, 106);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 112, 182, 50, 3, 3, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("• Économies sur facture (Autoconsommation directe ~70%) :", 20, 125);
    doc.text("• Revente du surplus (Tarif garanti EDF OA ~0,13 €/kWh) :", 20, 137);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`env. ${Math.round(economieAutoconsommation)} € / an`, 145, 125);
    doc.text(`env. ${Math.round(venteSurplus)} € / an`, 145, 137);

    doc.text("• Gain cumulé estimé sur 20 ans :", 20, 151);
    doc.setTextColor(67, 56, 202);
    doc.text(`+${Math.round(gain20ans)} €`, 145, 151);
    renderFooter(3);

    // Página 4
    doc.addPage();
    renderHeader("PROJECTION SUR 20 ANS", "Étape 3 sur 4");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Évolution Prévisionnelle de la Trésorerie", 14, 46);

    doc.setFillColor(15, 23, 42);
    doc.rect(14, 54, 182, 9, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Échéance", 20, 60);
    doc.text("Production (kWh)", 60, 60);
    doc.text("Économie / an (€)", 105, 60);
    doc.text("Bilan Cumulé Net (€)", 150, 60);

    const jalons = [1, 3, 5, 8, 10, 15, 20];
    let posY = 71;

    jalons.forEach((an, idx) => {
      const cumul = economieAnnuelle * an - coutInstallation;
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, posY - 5, 182, 8, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      doc.text(`Année ${an}`, 20, posY);
      doc.text(`${Math.round(productionEstimee)} kWh`, 60, posY);
      doc.text(`+${Math.round(economieAnnuelle * an)} €`, 105, posY);

      if (cumul >= 0) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129);
        doc.text(`+${Math.round(cumul)} €`, 150, posY);
      } else {
        doc.setTextColor(225, 29, 72);
        doc.text(`${Math.round(cumul)} €`, 150, posY);
      }

      posY += 9;
    });
    renderFooter(4);

    // Página 5
    doc.addPage();
    renderHeader("HYPOTHÈSES & MÉTHODOLOGIE", "Étape 4 sur 4");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Cadre Technique & Réglementaire", 14, 46);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 52, 182, 110, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("1. Hypothèses de Calcul", 20, 63);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("• Coût de référence électricité : 0,25 € / kWh TTC (Tarif Réglementé).", 20, 72);
    doc.text("• Taux d'autoconsommation moyen : 70% estimé selon profil résidentiel.", 20, 80);
    doc.text("• Rachat surplus : barème EDF Obligation d'Achat contracté sur 20 ans.", 20, 88);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("2. Garanties & Normes de Pose", 20, 104);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("• Modules monocristallins avec garantie de rendement linéaire 25 ans.", 20, 113);
    doc.text("• Onduleur haute efficacité avec suivi applicatif en temps réel.", 20, 121);
    doc.text("• Installation réalisée par des techniciens qualifiés RGE QualiPV.", 20, 129);
    doc.text("• Validation de conformité par le CONSUEL avant raccordement Enedis.", 20, 137);
    renderFooter(5);

    doc.save(`etude-solaire-complete-${nomClient.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Navbar Minimalista B2B com link para /pro */}
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white font-black text-xs">
              S
            </div>
            <span className="font-bold tracking-tight text-zinc-900 text-sm">
              SOLAR ENERGIE <span className="text-zinc-400 font-normal">| Ingénierie</span>
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href="/pro"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200/60 rounded-lg px-3 py-1.5 transition"
            >
              Vous êtes installateur ? Espace Pro →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="max-w-3xl mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-3">
            Simulateur d&apos;Ingénierie Solaire
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-zinc-950 tracking-tight leading-[1.15] mb-4">
            Dimensionnement & rentabilité photovoltaïque.
          </h1>
          <p className="text-zinc-500 text-base leading-relaxed">
            Chiffrez précisément votre production, vos flux financiers d&apos;autoconsommation et générez votre dossier d&apos;ingénierie certifié en PDF.
          </p>
        </div>

        {/* Layout Grid do Simulador */}
        <div id="simulateur" className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start mb-24">
          
          {/* Lado Esquerdo: Formulário em Etapas */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 sm:p-8 shadow-sm">
              
              {/* Stepper Minimalista */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2.5 text-xs font-semibold">
                  <span className={currentStep >= 1 ? "text-blue-600" : "text-zinc-400"}>
                    01. Logement
                  </span>
                  <span className={currentStep >= 2 ? "text-blue-600" : "text-zinc-400"}>
                    02. Puissance
                  </span>
                  <span className={currentStep >= 3 ? "text-blue-600" : "text-zinc-400"}>
                    03. Finalisation
                  </span>
                </div>
                <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: currentStep === 1 ? "33.3%" : currentStep === 2 ? "66.6%" : "100%",
                    }}
                  ></div>
                </div>
              </div>

              {/* ETAPA 1 */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 tracking-tight mb-1">
                      Localisation & Consommation
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Sélectionnez la zone géographique pour ajuster le facteur d&apos;ensoleillement.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-2">
                      Région du projet
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-3 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                    >
                      <option value="Île-de-France / Nord">Île-de-France / Nord (950 kWh/kWc)</option>
                      <option value="Grand-Est / Centre">Grand-Est / Centre (1 050 kWh/kWc)</option>
                      <option value="Sud-Ouest / Rhône-Alpes">Sud-Ouest / Rhône-Alpes (1 250 kWh/kWc)</option>
                      <option value="Provence / PACA / Occitanie">Provence / PACA / Occitanie (1 400 kWh/kWc)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium text-zinc-700">
                        Consommation électrique de référence
                      </label>
                      <span className="text-xs font-bold text-blue-600 font-mono bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
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
                      className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[11px] text-zinc-400 mt-1">
                      <span>2 000 kWh</span>
                      <span>8 000 kWh</span>
                      <span>15 000 kWh</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm shadow-sm cursor-pointer"
                    >
                      Étape suivante →
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 2 */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 tracking-tight mb-1">
                      Dimensionnement de l&apos;Installation
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Choisissez la puissance crête cible adaptée à la toiture.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-2.5">
                      Puissance installée
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { kw: 3, panels: "6-8 modules", budget: "7 500 €" },
                        { kw: 6, panels: "12-16 modules", budget: "13 000 €" },
                        { kw: 9, panels: "18-24 modules", budget: "18 000 €" },
                      ].map((item) => (
                        <button
                          key={item.kw}
                          type="button"
                          onClick={() => handlePuissanceChange(item.kw)}
                          className={`p-4 rounded-xl border text-left transition-all ${
                            puissanceKw === item.kw
                              ? "bg-blue-50/60 border-blue-600 text-zinc-900 shadow-sm"
                              : "bg-zinc-50/50 border-zinc-200 text-zinc-600 hover:border-zinc-300"
                          }`}
                        >
                          <div className="text-xl font-bold text-zinc-950 mb-1">
                            {item.kw} <span className="text-xs font-normal text-zinc-500">kWc</span>
                          </div>
                          <p className="text-[11px] font-medium text-zinc-700">{item.panels}</p>
                          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{item.budget}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-2">
                      Investissement indicatif (€ TTC)
                    </label>
                    <input
                      type="number"
                      value={coutInstallation}
                      onChange={(e) => setCoutInstallation(Number(e.target.value))}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition font-mono"
                    />
                  </div>

                  <div className="pt-4 border-t border-zinc-100 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium px-5 py-2.5 rounded-xl transition text-sm cursor-pointer"
                    >
                      ← Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm shadow-sm cursor-pointer"
                    >
                      Étape suivante →
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 3 */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 tracking-tight mb-1">
                      Coordonnées & Génération
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Renseignez vos coordonnées professionnelles pour éditer l&apos;audit complet.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                        Nom et prénom <span className="text-blue-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Jean Dupont"
                        value={nomClient}
                        onChange={(e) => setNomClient(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                          Adresse e-mail <span className="text-blue-600">*</span>
                        </label>
                        <input
                          type="email"
                          placeholder="jean.dupont@entreprise.fr"
                          value={emailClient}
                          onChange={(e) => setEmailClient(e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                          Téléphone
                        </label>
                        <input
                          type="tel"
                          placeholder="06 12 34 56 78"
                          value={telClient}
                          onChange={(e) => setTelClient(e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                        />
                      </div>
                    </div>

                    {errorMsg && (
                      <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">
                        {errorMsg}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium px-5 py-2.5 rounded-xl transition text-sm cursor-pointer"
                    >
                      ← Retour
                    </button>

                    <button
                      onClick={handleValidationAndPDF}
                      disabled={isSaving}
                      className="bg-zinc-950 hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-xl transition text-sm cursor-pointer"
                    >
                      {isSaving ? "Génération..." : "Télécharger l'Étude (PDF)"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lado Direito: Dashboard Numérico High-Impact */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 shadow-sm sticky top-24 space-y-6">
              
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Synthèse Prévisionnelle
                </span>
                <h2 className="text-xl font-extrabold text-zinc-950 tracking-tight mt-0.5">
                  Indicateurs Clés
                </h2>
              </div>

              {/* Grid 2x2 com Números Gigantes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[11px] font-medium text-zinc-500 block mb-1">Production</span>
                  <div className="text-2xl font-black text-zinc-950 font-mono tracking-tight">
                    {Math.round(productionEstimee).toLocaleString("fr-FR")}
                  </div>
                  <span className="text-[10px] text-zinc-400">kWh / an</span>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[11px] font-medium text-zinc-500 block mb-1">Économies</span>
                  <div className="text-2xl font-black text-blue-600 font-mono tracking-tight">
                    ~{Math.round(economieAnnuelle).toLocaleString("fr-FR")} €
                  </div>
                  <span className="text-[10px] text-zinc-400">par an</span>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[11px] font-medium text-zinc-500 block mb-1">Retour brut</span>
                  <div className="text-2xl font-black text-zinc-950 font-mono tracking-tight">
                    {payback}
                  </div>
                  <span className="text-[10px] text-zinc-400">années</span>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[11px] font-medium text-zinc-500 block mb-1">CO₂ évité</span>
                  <div className="text-2xl font-black text-emerald-600 font-mono tracking-tight">
                    {co2EviteKg}
                  </div>
                  <span className="text-[10px] text-zinc-400">kg / an</span>
                </div>
              </div>

              {/* Card Destaque: Ganho em 20 Anos */}
              <div className="p-5 rounded-xl bg-zinc-950 text-white space-y-2">
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span>Gain cumulé net (20 ans)</span>
                  <span className="font-mono text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">Amorti</span>
                </div>
                <div className="text-3xl font-black text-white font-mono tracking-tight">
                  +{Math.round(gain20ans).toLocaleString("fr-FR")} €
                </div>
              </div>

              {/* Gráfico SVG Minimalista */}
              <div className="pt-2">
                <div className="flex justify-between text-xs text-zinc-500 mb-2">
                  <span>Trésorerie 20 ans</span>
                  <span className="font-mono font-medium text-zinc-700">Seuil : {payback} ans</span>
                </div>
                <div className="h-20 w-full">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 70">
                    <line x1="20" y1="40" x2="295" y2="40" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="0" y="43" fill="#a1a1aa" fontSize="8" fontFamily="monospace">0€</text>
                    
                    <path
                      d="M 25 60 Q 110 40, 290 10"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                    />

                    <circle cx="25" cy="60" r="3" fill="#f43f5e" />
                    <circle cx="120" cy="40" r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx="290" cy="10" r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>

              {currentStep === 3 && (
                <button
                  onClick={handleValidationAndPDF}
                  disabled={isSaving}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white font-semibold py-3.5 px-4 rounded-xl transition text-sm cursor-pointer shadow-sm"
                >
                  {isSaving ? "Édition du PDF..." : "Télécharger le Dossier Technique (PDF)"}
                </button>
              )}

              {saveSuccess && (
                <p className="text-xs text-center text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded-xl py-2.5">
                  Dossier enregistré. Le téléchargement a débuté.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 1: Pourquoi utiliser notre simulateur ? */}
        <section className="border-t border-zinc-200 pt-16 mb-20">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block mb-2">
              Avantages Clés
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
              Pourquoi utiliser notre simulateur ?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 font-bold text-lg">
                ⚡
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-2">
                Résultats en quelques secondes
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
                Obtenez une première estimation fiable et instantanée de votre projet photovoltaïque sans engagement.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 font-bold text-lg">
                📊
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-2">
                Vision claire de votre rentabilité
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
                Visualisez vos économies prévisionnelles, votre flux de trésorerie annuel et votre temps de retour sur investissement.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 font-bold text-lg">
                📑
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-2">
                Votre étude complète en PDF
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
                Téléchargez immédiatement votre dossier technique d&apos;ingénierie de 5 pages pour conserver et comparer vos données.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: Comment ça marche ? */}
        <section className="border-t border-zinc-200 pt-16 mb-24">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block mb-2">
              Méthodologie
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
              Comment ça marche ?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm relative">
              <span className="text-xs font-mono font-bold text-blue-600 block mb-3">01</span>
              <h3 className="text-base font-bold text-zinc-900 mb-2">Vos informations</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Indiquez votre région géographique et votre niveau de consommation annuelle d&apos;électricité.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm relative">
              <span className="text-xs font-mono font-bold text-blue-600 block mb-3">02</span>
              <h3 className="text-base font-bold text-zinc-900 mb-2">Simulation</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                L&apos;algorithme calcule le productible solaire optimal en fonction de l&apos;ensoleillement régional.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm relative">
              <span className="text-xs font-mono font-bold text-blue-600 block mb-3">03</span>
              <h3 className="text-base font-bold text-zinc-900 mb-2">Résultats</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Découvrez votre bilan financier indicatif, le temps d&apos;amortissement et votre impact carbone.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm relative">
              <span className="text-xs font-mono font-bold text-blue-600 block mb-3">04</span>
              <h3 className="text-base font-bold text-zinc-900 mb-2">Étude PDF</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Éditez et téléchargez instantanément votre rapport complet prêt pour vos démarches.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: CTA FINAL */}
        <section className="bg-zinc-950 rounded-3xl p-8 sm:p-14 text-center text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Vous envisagez l&apos;installation de panneaux solaires ?
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
              Obtenez une première estimation de votre projet gratuitement en moins de 60 secondes.
            </p>
            <div className="pt-2">
              <a
                href="#simulateur"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-xl shadow-lg shadow-blue-600/20 transition transform active:scale-95 text-sm cursor-pointer"
              >
                <span>Simuler mon projet</span>
                <span>→</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Minimalista */}
      <footer className="border-t border-zinc-200 bg-white py-12 mt-20 text-xs text-zinc-400">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-medium text-zinc-700">
            SOLAR ENERGIE FRANCE • Solutions Photovoltaïques Résidentielles
          </p>
          <p className="text-zinc-400">
            Étude indicative établie selon les standards d&apos;ingénierie et barèmes de rachat 2026.
          </p>
        </div>
      </footer>
    </div>
  );
}