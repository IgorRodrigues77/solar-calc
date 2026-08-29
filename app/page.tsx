"use client";

import { useState } from "react";
import jsPDF from "jspdf";

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

  // Cálculos Técnicos e Financeiros
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

    // ==========================================
    // GERAÇÃO DO DOSSIER COMPLETO DE 5 PÁGINAS
    // ==========================================
    const doc = new jsPDF();
    const dateJour = new Date().toLocaleDateString("fr-FR");

    // Helper: Rodapé Padrão
    const renderFooter = (pageNumber: number) => {
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("SOLAR ENERGIE FRANCE • Dossier d'Étude Photovoltaïque • Confidentiel", 14, 285);
      doc.text(`Page ${pageNumber} / 5`, 185, 285);
    };

    // Helper: Cabeçalho Padrão para Páginas 2 a 5
    const renderHeader = (title: string, subtitle: string) => {
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.rect(0, 0, 210, 32, "F");

      doc.setTextColor(245, 158, 11);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("SOLAR ENERGIE FRANCE", 14, 13);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(title, 14, 23);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(subtitle, 130, 23);
    };

    // ==========================================
    // PAGE 1 — COUVERTURE (Page de Garde)
    // ==========================================
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 297, "F");

    // Linha de detalhe em cor solar
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 0, 8, 297, "F");

    doc.setTextColor(245, 158, 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
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

    doc.setFontSize(12);
    doc.setTextColor(203, 213, 225);
    doc.setFont("helvetica", "normal");
    doc.text("Dimensionnement technique, rentabilité prévisionnelle & bilan carbone", 25, 134);

    // Box Destinatário
    doc.setFillColor(30, 41, 59);
    doc.setDrawColor(51, 65, 85);
    doc.roundedRect(25, 175, 160, 45, 4, 4, "FD");

    doc.setTextColor(245, 158, 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("BÉNÉFICIAIRE DE L'ÉTUDE", 32, 187);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text(`Nom / Titulaire : ${nomClient}`, 32, 196);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`Contact : ${emailClient}  |  ${telClient || "Non renseigné"}`, 32, 204);
    doc.text(`Secteur : ${region}`, 32, 212);

    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Date d'émission : ${dateJour}`, 25, 260);
    doc.text("Rapport d'audit préliminaire généré automatiquement", 25, 266);

    // ==========================================
    // PAGE 2 — VOTRE PROJET (Synthèse Technique)
    // ==========================================
    doc.addPage();
    renderHeader("SYNTHÈSE DU PROJET", "Étape 1 sur 4");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("1. Caractéristiques de l'Installation", 14, 46);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 52, 182, 55, 3, 3, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`• Puissance crête sélectionnée :`, 20, 64);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`${puissanceKw} kWc (~${puissanceKw === 3 ? "6-8" : puissanceKw === 6 ? "12-16" : "18-24"} modules)`, 85, 64);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`• Surface de toiture requise :`, 20, 74);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`~${puissanceKw * 5} m² de toiture disponible`, 85, 74);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`• Estimation du gisement solaire :`, 20, 84);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`${productible} kWh/kWc/an (${region})`, 85, 84);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`• Production annuelle totale :`, 20, 94);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text(`${Math.round(productionEstimee)} kWh / an`, 85, 94);

    // Box Impact Environnemental
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("2. Bilan Écologique & Décarbonation", 14, 125);

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, 131, 182, 38, 3, 3, "FD");

    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("RÉDUCTION DE L'EMPREINTE CARBONE", 20, 141);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Grâce à la production décarbonée de votre centrale solaire, vous évitez :`, 20, 150);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(5, 150, 105);
    doc.text(`~${co2EviteKg} kg de CO₂ par an  (soit plus de ${(co2EviteKg * 20 / 1000).toFixed(1)} tonnes de CO₂ évitées sur 20 ans).`, 20, 159);

    renderFooter(2);

    // ==========================================
    // PAGE 3 — ANALYSE FINANCIÈRE
    // ==========================================
    doc.addPage();
    renderHeader("ANALYSE FINANCIÈRE", "Étape 2 sur 4");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Synthèse des Flux Économiques", 14, 46);

    // Cards Principais
    // Card Investissement
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 54, 56, 35, 3, 3, "FD");
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("INVESTISSEMENT ESTIMÉ", 18, 64);
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(`${coutInstallation} € TTC`, 18, 77);

    // Card Économie
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(77, 54, 56, 35, 3, 3, "FD");
    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("ÉCONOMIE ANNUELLE", 81, 64);
    doc.setFontSize(13);
    doc.text(`~${Math.round(economieAnnuelle)} € / an`, 81, 77);

    // Card Retour
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(140, 54, 56, 35, 3, 3, "FD");
    doc.setTextColor(180, 83, 9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("RETOUR ESTIMÉ", 144, 64);
    doc.setFontSize(13);
    doc.text(`${payback} ans`, 144, 77);

    // Detalhamento do Retorno
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Répartition des Revenus et Économies Annuelles :", 14, 106);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 112, 182, 45, 3, 3, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`• Économies sur facture (Autoconsommation directe ~70%) :`, 20, 124);
    doc.text(`~${Math.round(economieAutoconsommation)} € / an`, 155, 124);

    doc.text(`• Revente du surplus non consommé (Tarif garanti EDF OA ~0,13 €/kWh) :`, 20, 134);
    doc.text(`~${Math.round(venteSurplus)} € / an`, 155, 134);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`• Gain cumulé net estimé sur 20 ans :`, 20, 146);
    doc.setTextColor(67, 56, 202);
    doc.text(`+${Math.round(gain20ans)} €`, 155, 146);

    renderFooter(3);

    // ==========================================
    // PAGE 4 — PROJECTION SUR 20 ANS
    // ==========================================
    doc.addPage();
    renderHeader("PROJECTION SUR 20 ANS", "Étape 3 sur 4");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Évolution Prévisionnelle de la Trésorerie", 14, 46);

    // Tabela dos Anos
    doc.setFillColor(15, 23, 42);
    doc.rect(14, 54, 182, 9, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Année", 20, 60);
    doc.text("Production (kWh)", 55, 60);
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
      doc.text(`${Math.round(productionEstimee)} kWh`, 55, posY);
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

    // ==========================================
    // PAGE 5 — HYPOTHÈSES & MÉTHODOLOGIE
    // ==========================================
    doc.addPage();
    renderHeader("HYPOTHÈSES & MÉTHODOLOGIE", "Étape 4 sur 4");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
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
    doc.text("• Coût de l'électricité réseau de référence : 0,25 € / kWh TTC (Tarif Bleu réglementé).", 20, 72);
    doc.text("• Taux d'autoconsommation moyen estimé : 70% selon profil résidentiel standard.", 20, 80);
    doc.text("• Tarif de rachat surplus : fixé selon barème EDF Obligation d'Achat contracté sur 20 ans.", 20, 88);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("2. Garanties & Normes de Pose", 20, 102);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("• Modules photovoltaïques monocristallins avec garantie de rendement 25 ans.", 20, 111);
    doc.text("• Onduleur ou micro-onduleurs haute efficacité avec suivi applicatif en temps réel.", 20, 119);
    doc.text("• Installation réalisée par des techniciens qualifiés RGE QualiPV ouvrant droit aux aides d'État.", 20, 127);
    doc.text("• Attestation de conformité visée par le CONSUEL avant raccordement réseau Enedis.", 20, 135);

    renderFooter(5);

    // Salvar o arquivo PDF
    doc.save(`etude-solaire-complete-${nomClient.replace(/\s+/g, "_")}.pdf`);
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

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-12 pb-10 border-b border-slate-800/80">
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
                <span>Étude complète (5 pages PDF)</span>
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
                  Dossier d&apos;Étude 5 Pages
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

        {/* Wizard Multi-Step Form */}
        <div id="simulateur" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm">
              {/* Stepper Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3 text-xs font-semibold">
                  <span className={currentStep >= 1 ? "text-amber-400" : "text-slate-600"}>
                    1. Votre logement
                  </span>
                  <span className={currentStep >= 2 ? "text-amber-400" : "text-slate-600"}>
                    2. Votre installation
                  </span>
                  <span className={currentStep >= 3 ? "text-amber-400" : "text-slate-600"}>
                    3. Vos coordonnées
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: currentStep === 1 ? "33.3%" : currentStep === 2 ? "66.6%" : "100%",
                    }}
                  ></div>
                </div>
              </div>

              {/* ÉTAPE 1: Logement */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-1">
                      Étape 1 — Votre logement
                    </h2>
                    <p className="text-xs text-slate-400">
                      Renseignez votre localisation et votre consommation actuelle.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      Où se situe votre projet ?
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
                    >
                      <option value="Île-de-France / Nord">Île-de-France / Nord (~950 kWh/kWc)</option>
                      <option value="Grand-Est / Centre">Grand-Est / Centre (~1050 kWh/kWc)</option>
                      <option value="Sud-Ouest / Rhône-Alpes">Sud-Ouest / Rhône-Alpes (~1250 kWh/kWc)</option>
                      <option value="Provence / PACA / Occitanie">Provence / PACA / Occitanie (~1400 kWh/kWc)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium text-slate-300">
                        Quelle est votre consommation annuelle ?
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

                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl transition flex items-center gap-2 text-sm shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      <span>Continuer</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2: Installation */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-1">
                      Étape 2 — Votre installation
                    </h2>
                    <p className="text-xs text-slate-400">
                      Définissez la puissance et le coût prévisionnel de pose.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2.5">
                      Quelle puissance envisagez-vous ?
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

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      Quel est votre budget indicatif (€ TTC) ?
                    </label>
                    <input
                      type="number"
                      value={coutInstallation}
                      onChange={(e) => setCoutInstallation(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition font-mono"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-2.5 rounded-xl transition text-sm cursor-pointer"
                    >
                      ← Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl transition flex items-center gap-2 text-sm shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      <span>Continuer</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 3: Coordonnées */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-1">
                      Étape 3 — Vos coordonnées
                    </h2>
                    <p className="text-xs text-slate-400">
                      Remplissez vos informations pour débloquer votre bilan complet et télécharger le dossier de 5 pages.
                    </p>
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

                  <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-2.5 rounded-xl transition text-sm cursor-pointer"
                    >
                      ← Retour
                    </button>

                    <button
                      onClick={handleValidationAndPDF}
                      disabled={isSaving}
                      className="bg-amber-500 hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 text-slate-950 font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center space-x-2 text-sm cursor-pointer"
                    >
                      <span>📄</span>
                      <span>{isSaving ? "Génération..." : "Télécharger l'Étude Complète (PDF)"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lado Direito: Resultados WOW com Nomenclatura Prudente */}
          <div className="lg:col-span-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md sticky top-24 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Votre projet solaire</h2>
                  <p className="text-xs text-slate-400">Projection financière personnalisée et indicative</p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Étude Indicative
                </span>
              </div>

              {/* Tabela de Métricas WOW */}
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">☀️</span>
                    <span className="text-slate-300 font-medium">Production</span>
                  </div>
                  <span className="font-bold text-white font-mono">{Math.round(productionEstimee).toLocaleString("fr-FR")} kWh/an</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">💰</span>
                    <span className="text-emerald-300 font-medium">Économies estimées</span>
                  </div>
                  <span className="font-bold text-emerald-400 font-mono">~{Math.round(economieAnnuelle).toLocaleString("fr-FR")} €/an</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📈</span>
                    <span className="text-amber-300 font-medium">Temps de retour indicatif</span>
                  </div>
                  <span className="font-bold text-amber-400 font-mono">{payback} ans</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🌱</span>
                    <span className="text-slate-300 font-medium">CO₂ évité</span>
                  </div>
                  <span className="font-bold text-emerald-400 font-mono">~{co2EviteKg.toLocaleString("fr-FR")} kg/an</span>
                </div>
              </div>

              {/* Gráfico de Rentabilidade */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-slate-300">Votre investissement sur 20 ans</p>
                  <span className="text-xs font-bold text-emerald-400 font-mono">Gain cumulé estimé : +{Math.round(gain20ans).toLocaleString("fr-FR")} €</span>
                </div>

                <div className="h-32 w-full pt-2">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 90">
                    <line x1="25" y1="45" x2="295" y2="45" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="0" y="48" fill="#64748b" fontSize="8" fontFamily="monospace">0€</text>
                    <text x="0" y="16" fill="#10b981" fontSize="8" fontFamily="monospace">+10k€</text>
                    <text x="0" y="80" fill="#f43f5e" fontSize="8" fontFamily="monospace">-5k€</text>

                    <path
                      d="M 30 75 Q 120 45, 290 12"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                    />

                    <circle cx="30" cy="75" r="3.5" fill="#f43f5e" />
                    <text x="30" y="88" fill="#94a3b8" fontSize="7" textAnchor="middle">0 an</text>

                    <circle cx="125" cy="45" r="4" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.5" />
                    <text x="125" y="58" fill="#fbbf24" fontSize="7" fontWeight="bold" textAnchor="middle">{payback}a</text>

                    <circle cx="290" cy="12" r="4" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
                    <text x="285" y="24" fill="#10b981" fontSize="7" fontWeight="bold" textAnchor="end">20 ans</text>
                  </svg>
                </div>
              </div>

              {/* Botão de Ação Direta */}
              {currentStep === 3 && (
                <div>
                  <button
                    onClick={handleValidationAndPDF}
                    disabled={isSaving}
                    className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center space-x-2 text-sm cursor-pointer"
                  >
                    <span>📄</span>
                    <span>{isSaving ? "Génération en cours..." : "Télécharger mon Dossier d'Étude (PDF)"}</span>
                  </button>

                  {saveSuccess && (
                    <p className="mt-3 text-xs text-center text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-2">
                      ✓ Demande enregistrée. Votre étude est en cours de téléchargement.
                    </p>
                  )}
                </div>
              )}

              <p className="text-[11px] text-center text-slate-500">
                🔒 Vos données restent strictement confidentielles conformément au RGPD.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
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