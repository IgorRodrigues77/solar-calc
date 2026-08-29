"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import Link from "next/link";

interface AddressSuggestion {
  label: string;
  postcode: string;
  city: string;
  context: string;
  coordinates: [number, number]; // [lon, lat]
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showOnePageResult, setShowOnePageResult] = useState(false);

  // Endereço e Geocodificação
  const [addressInput, setAddressInput] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);
  const [isLoadingPvgis, setIsLoadingPvgis] = useState(false);

  // Dados Técnicos e Solares Reais (PVGIS)
  const [region, setRegion] = useState("Île-de-France / Nord");
  const [productible, setProductible] = useState(1050); // kWh/kWc/an
  const [puissanceKw, setPuissanceKw] = useState(6);
  const [consoAnnuelle, setConsoAnnuelle] = useState(4800);
  const [coutInstallation, setCoutInstallation] = useState(13000);

  // Dados do Lead
  const [nomClient, setNomClient] = useState("");
  const [emailClient, setEmailClient] = useState("");
  const [telClient, setTelClient] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Busca de Endereço na API Adresse du Gouvernement
  useEffect(() => {
    if (addressInput.length < 3 || (selectedAddress && addressInput === selectedAddress.label)) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(addressInput)}&limit=5`
        );
        const data = await res.json();
        if (data.features) {
          const list: AddressSuggestion[] = data.features.map((f: any) => ({
            label: f.properties.label,
            postcode: f.properties.postcode,
            city: f.properties.city,
            context: f.properties.context,
            coordinates: f.geometry.coordinates,
          }));
          setSuggestions(list);
        }
      } catch (err) {
        console.error("Erreur API Adresse:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [addressInput, selectedAddress]);

  // Integração Oficial PVGIS
  const fetchPvgisData = async (lat: number, lon: number, kw: number) => {
    setIsLoadingPvgis(true);
    try {
      const pvgisUrl = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lon}&peakpower=${kw}&loss=14&optimalinclination=1&outputformat=json`;
      const res = await fetch(pvgisUrl);
      const data = await res.json();

      if (data?.outputs?.totals?.fixed?.E_y) {
        const annualYield = data.outputs.totals.fixed.E_y;
        const calculatedProductible = Math.round(annualYield / kw);
        setProductible(calculatedProductible);
      }
    } catch (err) {
      console.warn("PVGIS API fallback:", err);
      if (lat < 44.5) setProductible(1400);
      else if (lat < 46.5) setProductible(1250);
      else setProductible(1000);
    } finally {
      setIsLoadingPvgis(false);
    }
  };

  const handleSelectAddress = (addr: AddressSuggestion) => {
    setSelectedAddress(addr);
    setAddressInput(addr.label);
    setSuggestions([]);

    const [lon, lat] = addr.coordinates;
    const dept = parseInt(addr.postcode.substring(0, 2), 10);

    if (lat < 44.5 || [13, 83, 84, 6, 4, 5, 30, 34, 66, 11, 20].includes(dept)) {
      setRegion("Provence / PACA / Occitanie");
    } else if (lat < 46.2 || [33, 40, 64, 24, 47, 69, 38, 73, 74].includes(dept)) {
      setRegion("Sud-Ouest / Rhône-Alpes");
    } else if (lat > 48.2 || [75, 77, 78, 91, 92, 93, 94, 95, 59, 62, 80, 60, 2].includes(dept)) {
      setRegion("Île-de-France / Nord");
    } else {
      setRegion("Grand-Est / Centre");
    }

    fetchPvgisData(lat, lon, puissanceKw);
  };

  const handlePuissanceChange = (val: number) => {
    setPuissanceKw(val);
    if (val === 3) setCoutInstallation(7500);
    else if (val === 6) setCoutInstallation(13000);
    else if (val === 9) setCoutInstallation(18000);

    if (selectedAddress) {
      const [lon, lat] = selectedAddress.coordinates;
      fetchPvgisData(lat, lon, val);
    }
  };

  // Cálculos Técnicos e Financeiros
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

  // AÇÃO 1: Apenas salva o lead e exibe a tela de resultado (sem baixar PDF)
  const handleShowResultOnly = async () => {
    if (!nomClient.trim() || !emailClient.trim()) {
      setErrorMsg("Veuillez renseigner votre nom et votre adresse e-mail.");
      return;
    }

    setErrorMsg("");
    setIsSaving(true);

    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nomClient,
          email: emailClient,
          telephone: telClient,
          adresse: selectedAddress ? selectedAddress.label : addressInput,
          region,
          productible_pvgis: productible,
          puissance_kw: puissanceKw,
          economie_annuelle: Math.round(economieAnnuelle),
          gain_20ans: Math.round(gain20ans),
        }),
      });
      setShowOnePageResult(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      // Avança para o resultado mesmo em caso de erro na API
      setShowOnePageResult(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSaving(false);
    }
  };

  // AÇÃO 2: Download do PDF exclusivo via botão dedicado
  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);

    const doc = new jsPDF();
    const dateJour = new Date().toLocaleDateString("fr-FR");
    const adresseAffichee = selectedAddress ? selectedAddress.label : addressInput || "Adresse non spécifiée";

    const renderFooter = (pageNumber: number) => {
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("SOLAR ENERGIE FRANCE • Étude Technique Prévisionnelle (Données PVGIS JRC) • Confidentiel", 14, 285);
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
      doc.text(subtitle, 145, 23);
    };

    // Página 1 (Capa)
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
    doc.text("Calculs basés sur le modèle satellitaire PVGIS (Commission Européenne)", 25, 134);

    doc.setFillColor(30, 41, 59);
    doc.setDrawColor(51, 65, 85);
    doc.roundedRect(25, 175, 160, 52, 4, 4, "FD");

    doc.setTextColor(59, 130, 246);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("BÉNÉFICIAIRE & LOCALISATION DU PROJET", 32, 186);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10.5);
    doc.text(`Nom / Titulaire : ${nomClient || "Non renseigné"}`, 32, 195);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Adresse : ${adresseAffichee}`, 32, 203);
    doc.text(`Contact : ${emailClient || "Non renseigné"}  |  ${telClient || "Non renseigné"}`, 32, 211);
    doc.text(`Productible PVGIS : ${productible} kWh / kWc / an`, 32, 219);

    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Date d'émission : ${dateJour}`, 25, 260);
    doc.text("Rapport certifié édité selon les normes PVGIS 5.2", 25, 266);

    // Página 2 (Técnica)
    doc.addPage();
    renderHeader("SYNTHÈSE DU PROJET", "Étape 1 sur 4");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("1. Caractéristiques Techniques de l'Installation", 14, 46);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 52, 182, 65, 3, 3, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("• Emplacement du site :", 20, 62);
    doc.text("• Puissance crête sélectionnée :", 20, 72);
    doc.text("• Surface de toiture requise :", 20, 82);
    doc.text("• Gisement solaire réel (PVGIS) :", 20, 92);
    doc.text("• Production annuelle estimée :", 20, 102);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`${adresseAffichee}`, 95, 62);
    doc.text(`${puissanceKw} kWc (${puissanceKw === 3 ? "6-8" : puissanceKw === 6 ? "12-16" : "18-24"} modules)`, 95, 72);
    doc.text(`env. ${puissanceKw * 5} m2 de toiture`, 95, 82);
    doc.text(`${productible} kWh/kWc/an (Base JRC PVGIS)`, 95, 92);
    doc.setTextColor(16, 185, 129);
    doc.text(`${Math.round(productionEstimee)} kWh / an`, 95, 102);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("2. Bilan Écologique & Décarbonation", 14, 130);

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, 136, 182, 38, 3, 3, "FD");

    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("RÉDUCTION DE L'EMPREINTE CARBONE", 20, 146);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Grâce à la production décarbonée de votre centrale solaire, vous évitez :", 20, 155);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(5, 150, 105);
    doc.text(`env. ${co2EviteKg} kg de CO2 par an (soit ${(co2EviteKg * 20 / 1000).toFixed(1)} tonnes de CO2 évitées sur 20 ans).`, 20, 164);
    renderFooter(2);

    // Página 3 (Financeira)
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

    // Página 4 (Projeção 20 Anos)
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

    // Página 5 (Normas)
    doc.addPage();
    renderHeader("HYPOTHÈSES & MÉTHODOLOGIE", "Étape 4 sur 4");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Cadre Technique & Données Satellitaires PVGIS", 14, 46);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 52, 182, 115, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("1. Modèle de Rayonnement Solaire (PVGIS JRC)", 20, 63);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("• Source : Photovoltaic Geographical Information System (PVGIS v5.2 - UE).", 20, 72);
    doc.text("• Données météo : Re-analyse satellitaire SARAH2 haute résolution.", 20, 80);
    doc.text(`• Facteur de productible appliqué au site : ${productible} kWh / kWc / an.`, 20, 88);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("2. Garanties & Conformité Réglementaire", 20, 102);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("• Modules monocristallins avec garantie de rendement linéaire 25 ans.", 20, 111);
    doc.text("• Installation réalisée par des artisans qualifiés RGE QualiPV.", 20, 119);
    doc.text("• Rachat garanti sur 20 ans par EDF OA selon barème CRE en vigueur.", 20, 127);
    doc.text("• Validation de conformité par le CONSUEL avant raccordement Enedis.", 20, 135);
    renderFooter(5);

    const clientFilename = (nomClient || "etude").trim().replace(/\s+/g, "_");
    doc.save(`etude-solaire-pvgis-${clientFilename}.pdf`);
    setIsGeneratingPdf(false);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white font-black text-xs">
              S
            </div>
            <span className="font-bold tracking-tight text-zinc-900 text-sm">
              SOLAR ENERGIE <span className="text-zinc-400 font-normal">| Ingénierie PVGIS</span>
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Données PVGIS 5.2
            </span>
            <Link
              href="/pro"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200/60 rounded-lg px-3 py-1.5 transition"
            >
              Espace Pro →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        
        {/* TELA DE RESULTADO EM 1 PÁGINA (FICHA EXECUTIVA) */}
        {showOnePageResult ? (
          <div className="max-w-4xl mx-auto bg-white border border-zinc-200 rounded-3xl p-8 sm:p-12 shadow-sm mb-16 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-100 pb-8 mb-8 gap-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-blue-600 font-semibold block mb-1">
                  Bilan Personnalisé du Projet
                </span>
                <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
                  VOTRE PROJET SOLAIRE
                </h1>
                <p className="text-zinc-500 text-sm mt-1">
                  {selectedAddress ? selectedAddress.label : addressInput || "Installation Résidentielle"}
                </p>
              </div>
              <div className="bg-zinc-950 text-white px-5 py-3 rounded-2xl text-center sm:text-right shadow-sm">
                <span className="text-[10px] text-zinc-400 uppercase font-mono block">Puissance cible</span>
                <span className="text-2xl font-black text-blue-400 font-mono">{puissanceKw} kWc</span>
              </div>
            </div>

            {/* Grid dos 4 Grandes Resultados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
              <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                <div className="flex items-center gap-2 text-zinc-500 text-xs font-semibold mb-2">
                  <span>☀️</span>
                  <span>Production estimée</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-zinc-950 font-mono tracking-tight">
                  {Math.round(productionEstimee).toLocaleString("fr-FR")} <span className="text-lg font-normal text-zinc-500">kWh/an</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-2">
                  Calculé selon l&apos;ensoleillement réel PVGIS ({productible} kWh/kWc/an)
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100">
                <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold mb-2">
                  <span>💰</span>
                  <span>Économies estimées</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-blue-600 font-mono tracking-tight">
                  ~{Math.round(economieAnnuelle).toLocaleString("fr-FR")} <span className="text-lg font-normal text-blue-600/70">€/an</span>
                </div>
                <p className="text-[11px] text-blue-600/80 mt-2">
                  Autoconsommation directe (~70%) + revente du surplus EDF OA
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                <div className="flex items-center gap-2 text-zinc-500 text-xs font-semibold mb-2">
                  <span>📈</span>
                  <span>Retour sur investissement</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-zinc-950 font-mono tracking-tight">
                  {payback} <span className="text-lg font-normal text-zinc-500">ans</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-2">
                  Investissement indicatif de {coutInstallation.toLocaleString("fr-FR")} € TTC
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold mb-2">
                  <span>🌱</span>
                  <span>CO₂ évité</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono tracking-tight">
                  {co2EviteKg} <span className="text-lg font-normal text-emerald-600/70">kg/an</span>
                </div>
                <p className="text-[11px] text-emerald-600/80 mt-2">
                  Soit {(co2EviteKg * 20 / 1000).toFixed(1)} tonnes de CO₂ évitées sur le cycle de 20 ans
                </p>
              </div>
            </div>

            {/* Bilan 20 ans & Botão de Download Exclusivo */}
            <div className="p-6 rounded-2xl bg-zinc-950 text-white mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-xs text-zinc-400 uppercase font-mono">Gain financier cumulé estimé</p>
                <p className="text-2xl sm:text-3xl font-black text-white font-mono mt-0.5">
                  +{Math.round(gain20ans).toLocaleString("fr-FR")} € <span className="text-xs font-normal text-emerald-400 font-sans">sur 20 ans</span>
                </p>
              </div>

              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-semibold py-3.5 px-6 rounded-xl transition text-sm shadow-md cursor-pointer"
              >
                {isGeneratingPdf ? "Édition en cours..." : "Télécharger l'étude PDF (5 pages) →"}
              </button>
            </div>

            <div className="text-center">
              <button
                onClick={() => {
                  setShowOnePageResult(false);
                  setCurrentStep(1);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-900 font-medium underline underline-offset-4 cursor-pointer"
              >
                ← Réaliser une nouvelle simulation
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <div className="max-w-3xl mb-12">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 mb-3">
                <span>Données Solaires Officielles PVGIS / Commission Européenne</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-zinc-950 tracking-tight leading-[1.15] mb-4">
                Étude photovoltaïque de précision.
              </h1>
              <p className="text-zinc-500 text-base leading-relaxed">
                Chiffrez votre rentabilité sur base satellitaire réelle et éditez votre dossier complet d&apos;ingénierie certifié.
              </p>
            </div>

            {/* Layout Grid do Simulador */}
            <div id="simulateur" className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start mb-24">
              
              {/* Formulário em Etapas */}
              <div className="lg:col-span-7">
                <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 sm:p-8 shadow-sm">
                  
                  {/* Stepper */}
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-2.5 text-xs font-semibold">
                      <span className={currentStep >= 1 ? "text-blue-600" : "text-zinc-400"}>
                        01. Adresse & Gisement
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
                          Localisation du projet
                        </h2>
                        <p className="text-xs text-zinc-500">
                          Renseignez l&apos;adresse du bien pour interroger le modèle satellitaire PVGIS.
                        </p>
                      </div>

                      <div className="relative">
                        <label className="block text-xs font-medium text-zinc-700 mb-2">
                          Adresse postale
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 12 Rue de Paris, Massy"
                          value={addressInput}
                          onChange={(e) => setAddressInput(e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-3 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                        />

                        {suggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
                            {suggestions.map((s, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelectAddress(s)}
                                className="w-full text-left px-4 py-3 text-xs sm:text-sm text-zinc-800 hover:bg-blue-50/80 hover:text-blue-900 border-b border-zinc-100 last:border-b-0 transition flex flex-col"
                              >
                                <span className="font-medium text-zinc-900">{s.label}</span>
                                <span className="text-[11px] text-zinc-400 mt-0.5">{s.context}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {selectedAddress && (
                        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 space-y-2 text-xs">
                          <div className="flex justify-between items-center text-blue-950 font-semibold">
                            <span>Coordonnées GPS :</span>
                            <span className="font-mono text-zinc-600">
                              {selectedAddress.coordinates[1].toFixed(4)}°N, {selectedAddress.coordinates[0].toFixed(4)}°E
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-blue-900">
                            <span>Gisement solaire réel (PVGIS JRC) :</span>
                            <span className="font-mono font-bold text-blue-700">
                              {isLoadingPvgis ? "Calcul satellitaire..." : `${productible} kWh / kWc / an`}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="pt-2">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-medium text-zinc-700">
                            Consommation électrique annuelle
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
                          Sélectionnez la puissance crête désirée.
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
                          Coordonnées & Finalisation
                        </h2>
                        <p className="text-xs text-zinc-500">
                          Renseignez vos coordonnées pour afficher le bilan en 1 page.
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
                          onClick={handleShowResultOnly}
                          disabled={isSaving}
                          className="bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-xl transition text-sm cursor-pointer shadow-sm"
                        >
                          {isSaving ? "Chargement..." : "Afficher mon Résultat →"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dashboard Numérico Lateral */}
              <div className="lg:col-span-5">
                <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 shadow-sm sticky top-24 space-y-6">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                        Modèle Satellitaire JRC
                      </span>
                      <h2 className="text-xl font-extrabold text-zinc-950 tracking-tight mt-0.5">
                        Indicateurs PVGIS
                      </h2>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {productible} kWh/kWc
                    </span>
                  </div>

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

                  <div className="p-5 rounded-xl bg-zinc-950 text-white space-y-2">
                    <div className="flex justify-between items-center text-xs text-zinc-400">
                      <span>Gain cumulé estimé (20 ans)</span>
                      <span className="font-mono text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">Amorti</span>
                    </div>
                    <div className="text-3xl font-black text-white font-mono tracking-tight">
                      +{Math.round(gain20ans).toLocaleString("fr-FR")} €
                    </div>
                  </div>

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
                </div>
              </div>
            </div>
          </>
        )}

        {/* Vantagens */}
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
                Modèle Satellitaire PVGIS
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
                Calculs d&apos;ensoleillement réels basés sur les bases de données SARAH2 de la Commission Européenne.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 font-bold text-lg">
                📊
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-2">
                Vision financière complète
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
                Visualisez vos économies d&apos;autoconsommation, vos revenus EDF OA et votre retour sur investissement.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 font-bold text-lg">
                📑
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-2">
                Dossier d&apos;Ingénierie 5 Pages
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
                Exportez un rapport technique documenté prêt à être présenté à un installateur qualifié RGE QualiPV.
              </p>
            </div>
          </div>
        </section>

        {/* Como Funciona */}
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
              <h3 className="text-base font-bold text-zinc-900 mb-2">Votre adresse</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Indiquez l&apos;adresse du bien pour extraire les coordonnées GPS exactes.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm relative">
              <span className="text-xs font-mono font-bold text-blue-600 block mb-3">02</span>
              <h3 className="text-base font-bold text-zinc-900 mb-2">Calcul PVGIS</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                L&apos;algorithme interroge la base européenne pour obtenir le gisement solaire exact.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm relative">
              <span className="text-xs font-mono font-bold text-blue-600 block mb-3">03</span>
              <h3 className="text-base font-bold text-zinc-900 mb-2">Résultats</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Découvrez vos indicateurs financiers personnalisés et le bilan carbone.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm relative">
              <span className="text-xs font-mono font-bold text-blue-600 block mb-3">04</span>
              <h3 className="text-base font-bold text-zinc-900 mb-2">Étude PDF</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Éditez et téléchargez votre étude de 5 pages certifiée.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="bg-zinc-950 rounded-3xl p-8 sm:p-14 text-center text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Vous envisagez l&apos;installation de panneaux solaires ?
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
              Obtenez une première estimation basée sur les données PVGIS en moins de 60 secondes.
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

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-12 mt-20 text-xs text-zinc-400">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-medium text-zinc-700">
            SOLAR ENERGIE FRANCE • Données Satellitaires PVGIS v5.2
          </p>
          <p className="text-zinc-400">
            Étude indicative établie selon les standards d&apos;ingénierie et barèmes de rachat 2026.
          </p>
        </div>
      </footer>
    </div>
  );
}