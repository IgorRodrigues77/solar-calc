"use client";

import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import Link from "next/link";
import { calculateSolarScenario, getRecommendedPower, getInstallationCost, DEFAULT_PRICES } from "./lib/solarCalculations";


interface AddressSuggestion {
  label: string;
  postcode: string;
  city: string;
  context: string;
  coordinates: [number, number];
}

interface CompanyConfig {
  companyName?: string;
  logoBase64?: string;
  telephone?: string;
  email?: string;
  website?: string;
  address?: string;
  siret?: string;
  primaryColor?: string;
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showOnePageResult, setShowOnePageResult] = useState(false);

  // Leitor Inteligente de Fatura
  const [isParsingBill, setIsParsingBill] = useState(false);
  const [extractedBillData, setExtractedBillData] = useState<{
    nom?: string;
    adresse?: string;
    conso?: number;
    puissanceRec?: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuração White-Label
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig>({
    companyName: "SOLAR ENERGIE",
  });

  useEffect(() => {
    const saved = localStorage.getItem("solar_company_config");
    if (saved) {
      try {
        setCompanyConfig(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Endereço e Geocodificação
  const [addressInput, setAddressInput] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);
  const [isLoadingPvgis, setIsLoadingPvgis] = useState(false);

  // Dados Técnicos e Solares Reais (PVGIS)
  const [region, setRegion] = useState("Île-de-France / Nord");
  const [productible, setProductible] = useState(1050);
  const [pvgisError, setPvgisError] = useState("");
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

  const fetchPvgisData = async (lat: number, lon: number, kw: number) => {
    setIsLoadingPvgis(true);
    setPvgisError("");
    try {
      const pvgisUrl = `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=${lat}&lon=${lon}&peakpower=${kw}&loss=14&optimalinclination=1&outputformat=json`;
      const res = await fetch(pvgisUrl);
      if (!res.ok) throw new Error(`PVGIS HTTP ${res.status}`);
      const data = await res.json();
      const annualYield = data?.outputs?.totals?.fixed?.E_y;
      if (typeof annualYield !== "number" || annualYield <= 0) {
        throw new Error("PVGIS n'a pas retourné une production annuelle exploitable.");
      }
      setProductible(Math.round(annualYield / kw));
    } catch (err) {
      console.warn("Erreur PVGIS:", err);
      setPvgisError("Les données solaires du site n'ont pas pu être récupérées. Vérifiez l'adresse ou réessayez.");
    } finally {
      setIsLoadingPvgis(false);
    }
  };

  const handleSelectAddress = (addr: AddressSuggestion) => {
    setPvgisError("");
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
    setCoutInstallation(getInstallationCost(val));

    if (selectedAddress) {
      const [lon, lat] = selectedAddress.coordinates;
      fetchPvgisData(lat, lon, val);
    }
  };

  // Upload e chamada para a rota de backend /api/parse-bill
  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingBill(true);
    setExtractedBillData(null);
    setErrorMsg("");

    try {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Veuillez sélectionner une facture au format PDF.");
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-bill", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok && !data.nom && !data.adresse) {
        throw new Error(data.error || "Impossible d'analyser cette facture.");
      }

      if (data.nom) setNomClient(data.nom);

      if (data.adresse) {
        setAddressInput(data.adresse);
        try {
          const geoRes = await fetch(
            `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(data.adresse)}&limit=1`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.features?.length > 0) handleSelectAddress(geoData.features[0]);
          }
        } catch (geoErr) {
          console.warn("Géocodage automatique ignoré:", geoErr);
        }
      }

      let puissanceRec: number | undefined;
      if (typeof data.conso === "number" && data.conso > 0) {
        setConsoAnnuelle(data.conso);
        puissanceRec = getRecommendedPower(data.conso);
        handlePuissanceChange(puissanceRec);
      }

      setExtractedBillData({
        nom: data.nom || undefined,
        adresse: data.adresse || undefined,
        conso: typeof data.conso === "number" ? data.conso : undefined,
        puissanceRec,
      });

      if (!data.success && data.error) setErrorMsg(data.error);
    } catch (err) {
      console.error("Erreur lecture facture:", err);
      setErrorMsg(err instanceof Error ? err.message : "Impossible d'analyser ce document.");
    } finally {
      setIsParsingBill(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const calculateScenario = (kw: number, customCost?: number) =>
    calculateSolarScenario(kw, productible, consoAnnuelle, customCost);

  const currentScenario = calculateScenario(puissanceKw, coutInstallation);
  const scenario3k = calculateScenario(3, 7500);
  const scenario6k = calculateScenario(6, 13000);
  const scenario9k = calculateScenario(9, 18000);

  const handleShowResultOnly = async () => {
    if (!nomClient.trim()) {
      setErrorMsg("Veuillez renseigner le nom du client.");
      return;
    }

    setErrorMsg("");
    setIsSaving(true);

    try {
      try {
        await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nom: nomClient.trim(),
            email: emailClient.trim() || null,
            telephone: telClient.trim() || null,
            adresse: selectedAddress ? selectedAddress.label : addressInput.trim() || null,
            region,
            societe: companyConfig.companyName || "SOLAR ENERGIE",
            productible_pvgis: productible,
            puissance_kw: puissanceKw,
            economie_annuelle: Math.round(currentScenario.ecoAnnuelle),
            gain_20ans: Math.round(currentScenario.gain20),
          }),
        });
      } catch (saveError) {
        console.warn("Enregistrement distant indisponible:", saveError);
      }

      const localProject = {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
        created_at: new Date().toISOString(),
        nom: nomClient.trim(),
        email: emailClient.trim(),
        telephone: telClient.trim(),
        adresse: selectedAddress ? selectedAddress.label : addressInput.trim(),
        region,
        puissance_kw: puissanceKw,
        economie_annuelle: Math.round(currentScenario.ecoAnnuelle),
        gain_20ans: Math.round(currentScenario.gain20),
        productible,
        conso_annuelle: consoAnnuelle,
      };
      try {
        const existing = JSON.parse(localStorage.getItem("solar_projects") || "[]");
        const safeExisting = Array.isArray(existing) ? existing : [];
        localStorage.setItem("solar_projects", JSON.stringify([localProject, ...safeExisting].slice(0, 100)));
      } catch (storageError) {
        console.warn("Historique local indisponible:", storageError);
      }

      setShowOnePageResult(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      setShowOnePageResult(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);

    try {
      const doc = new jsPDF();
      const dateJour = new Date().toLocaleDateString("fr-FR");
      const adresseAffichee = selectedAddress ? selectedAddress.label : addressInput || "Adresse non spécifiée";
      const brandName = (companyConfig.companyName || "SOLAR ENERGIE").trim();
      const primary = companyConfig.primaryColor || "#2563eb";

      const hexToRgb = (hex: string) => {
        const normalized = hex.replace("#", "");
        const value = normalized.length === 3
          ? normalized.split("").map((c) => c + c).join("")
          : normalized;
        const n = Number.parseInt(value, 16);
        return {
          r: (n >> 16) & 255,
          g: (n >> 8) & 255,
          b: n & 255,
        };
      };

      const brandRgb = hexToRgb(primary);

      const split = (text: string, width: number) => doc.splitTextToSize(text, width);

      const addLogo = (x: number, y: number, maxW: number, maxH: number) => {
        if (!companyConfig.logoBase64) return false;
        try {
          const format = companyConfig.logoBase64.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
          doc.addImage(companyConfig.logoBase64, format, x, y, maxW, maxH);
          return true;
        } catch {
          return false;
        }
      };

      const renderFooter = (pageNumber: number) => {
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        const footerText = `Pré-étude réalisée par ${brandName}${companyConfig.siret ? ` • SIRET : ${companyConfig.siret}` : ""} • Données PVGIS • Confidentiel`;
        doc.text(footerText, 14, 287);
        doc.text(`Page ${pageNumber} / 5`, 182, 287);
      };

      const renderHeader = (title: string, subtitle = "") => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 30, "F");
        doc.setTextColor(brandRgb.r, brandRgb.g, brandRgb.b);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text(brandName.toUpperCase(), 14, 12);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(title, 14, 22);
        if (subtitle) {
          doc.setTextColor(148, 163, 184);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.text(subtitle, 145, 22);
        }
      };

      const drawMetric = (x: number, y: number, w: number, label: string, value: string, tone: "dark" | "blue" | "green" = "dark") => {
        const bg = tone === "blue" ? [239, 246, 255] : tone === "green" ? [236, 253, 245] : [248, 250, 252];
        const text = tone === "blue" ? [37, 99, 235] : tone === "green" ? [5, 150, 105] : [15, 23, 42];
        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, w, 30, 3, 3, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label, x + 5, y + 9);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(text[0], text[1], text[2]);
        doc.text(value, x + 5, y + 22);
      };

      // PAGE 1 — COVER
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 297, "F");
      doc.setFillColor(brandRgb.r, brandRgb.g, brandRgb.b);
      doc.rect(0, 0, 6, 297, "F");

      const hasLogo = addLogo(25, 28, 42, 20);
      if (!hasLogo) {
        doc.setTextColor(brandRgb.r, brandRgb.g, brandRgb.b);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text(brandName.toUpperCase(), 25, 43);
      }

      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const companyMeta = [companyConfig.website, companyConfig.telephone].filter(Boolean).join(" • ");
      if (companyMeta) doc.text(companyMeta, 25, 55);

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(25);
      doc.text("ÉTUDE PHOTOVOLTAÏQUE", 25, 108);
      doc.setFontSize(11);
      doc.setTextColor(203, 213, 225);
      doc.setFont("helvetica", "normal");
      doc.text("Pré-étude énergétique et financière prévisionnelle", 25, 122);

      doc.setFillColor(30, 41, 59);
      doc.setDrawColor(51, 65, 85);
      doc.roundedRect(25, 165, 160, 66, 4, 4, "FD");
      doc.setTextColor(brandRgb.r, brandRgb.g, brandRgb.b);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("PROJET", 32, 177);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text(`Client : ${nomClient || "Non renseigné"}`, 32, 188);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225);
      const addressLines = split(`Site : ${adresseAffichee}`, 145);
      doc.text(addressLines, 32, 199);
      doc.text(`Puissance étudiée : ${puissanceKw} kWc`, 32, 199 + addressLines.length * 5 + 6);

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.text(`Date d'émission : ${dateJour}`, 25, 260);
      doc.text("Document de pré-étude — résultats indicatifs à confirmer selon les caractéristiques réelles du site.", 25, 268);
      renderFooter(1);

      // PAGE 2 — PROJECT SYNTHESIS
      doc.addPage();
      renderHeader("SYNTHÈSE DU PROJET", "Données techniques");
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Caractéristiques du projet", 14, 45);

      drawMetric(14, 54, 84, "Puissance étudiée", `${puissanceKw} kWc`, "dark");
      drawMetric(106, 54, 90, "Production estimée", `${Math.round(currentScenario.prod).toLocaleString("fr-FR")} kWh/an`, "green");
      drawMetric(14, 89, 84, "Consommation annuelle", `${Math.round(consoAnnuelle).toLocaleString("fr-FR")} kWh/an`, "dark");
      drawMetric(106, 89, 90, "Productible PVGIS", `${productible.toLocaleString("fr-FR")} kWh/kWc/an`, "blue");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("Bilan énergétique estimé", 14, 136);

      const energyRows = [
        ["Production solaire", `${Math.round(currentScenario.prod).toLocaleString("fr-FR")} kWh/an`],
        ["Énergie autoconsommée", `${Math.round(currentScenario.autoconsoKwh).toLocaleString("fr-FR")} kWh/an`],
        ["Surplus injecté / valorisable", `${Math.round(currentScenario.surplusKwh).toLocaleString("fr-FR")} kWh/an`],
        ["Taux d'autoconsommation", `${currentScenario.tauxAutoconsommation.toFixed(0)} %`],
      ];
      let y = 147;
      energyRows.forEach(([label, value], index) => {
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, y - 6, 182, 13, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(label, 20, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(value, 145, y);
        y += 14;
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("Localisation & méthodologie", 14, 210);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(split(`Adresse : ${adresseAffichee}`, 170), 20, 222);
      doc.text("Les estimations de productible sont obtenues via l'API PVGIS à partir des coordonnées du site.", 20, 238);
      doc.text("Le modèle actuel applique une perte système de 14 % et une inclinaison optimale dans PVGIS.", 20, 250);

      renderFooter(2);

      // PAGE 3 — SCENARIOS
      doc.addPage();
      renderHeader("COMPARAISON DES SCÉNARIOS", "3 puissances");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Comparatif énergétique et financier", 14, 45);

      const scenarios = [scenario3k, scenario6k, scenario9k];
      const scenarioLabels = ["OPTION A", "OPTION B", "OPTION C"];
      scenarios.forEach((sc, i) => {
        const x = 14 + i * 62;
        const selected = sc.kw === puissanceKw;
        doc.setFillColor(selected ? 239 : 248, selected ? 246 : 250, selected ? 255 : 252);
        doc.setDrawColor(selected ? brandRgb.r : 226, selected ? brandRgb.g : 232, selected ? brandRgb.b : 240);
        doc.roundedRect(x, 56, 58, 126, 3, 3, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(selected ? brandRgb.r : 15, selected ? brandRgb.g : 23, selected ? brandRgb.b : 42);
        doc.text(`${scenarioLabels[i]} • ${sc.kw} kWc`, x + 5, 67);
        if (selected) {
          doc.setFontSize(6.8);
          doc.setTextColor(5, 150, 105);
          doc.text("SÉLECTIONNÉ", x + 5, 75);
        }

        const rows = [
          ["Investissement", `${sc.cost.toLocaleString("fr-FR")} €`],
          ["Production", `${Math.round(sc.prod).toLocaleString("fr-FR")} kWh/an`],
          ["Autoconsommée", `${Math.round(sc.autoconsoKwh).toLocaleString("fr-FR")} kWh/an`],
          ["Surplus", `${Math.round(sc.surplusKwh).toLocaleString("fr-FR")} kWh/an`],
          ["Économies", `~${Math.round(sc.ecoAnnuelle).toLocaleString("fr-FR")} €/an`],
          ["Retour", `${sc.roi} ans`],
          ["Gain 20 ans", `${sc.gain20 >= 0 ? "+" : ""}${Math.round(sc.gain20).toLocaleString("fr-FR")} €`],
        ];
        let sy = 89;
        rows.forEach(([label, value]) => {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.8);
          doc.setTextColor(100, 116, 139);
          doc.text(label, x + 5, sy);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.4);
          doc.setTextColor(label === "Économies" ? 37 : label === "Gain 20 ans" ? 5 : 15, label === "Économies" ? 99 : label === "Gain 20 ans" ? 150 : 23, label === "Économies" ? 235 : label === "Gain 20 ans" ? 105 : 42);
          doc.text(value, x + 5, sy + 7);
          sy += 13;
        });
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Les investissements affichés sont des hypothèses indicatives du simulateur et doivent être remplacés par un chiffrage réel.", 14, 198);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("Lecture recommandée", 14, 220);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(split("Comparez la production, l'autoconsommation et le temps de retour plutôt que la seule production annuelle. Le scénario doit être confirmé avec les contraintes réelles de toiture, d'usage et de raccordement.", 175), 14, 231);

      renderFooter(3);

      // PAGE 4 — FINANCIAL PROJECTION
      doc.addPage();
      renderHeader("PROJECTION FINANCIÈRE", "Horizon 20 ans");
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Évolution indicative du gain cumulé", 14, 45);

      const chartX = 18;
      const chartY = 62;
      const chartW = 174;
      const chartH = 88;
      const maxValue = Math.max(currentScenario.gain20, 0);
      const minValue = Math.min(-coutInstallation, 0);
      const range = Math.max(1, maxValue - minValue);
      const zeroY = chartY + chartH - ((0 - minValue) / range) * chartH;

      doc.setDrawColor(226, 232, 240);
      doc.rect(chartX, chartY, chartW, chartH);
      doc.setDrawColor(148, 163, 184);
      doc.line(chartX, zeroY, chartX + chartW, zeroY);

      const points: { x: number; y: number }[] = [];
      for (let year = 0; year <= 20; year++) {
        const cumulative = year === 0 ? -coutInstallation : currentScenario.ecoAnnuelle * year - coutInstallation;
        const x = chartX + (year / 20) * chartW;
        const y = chartY + chartH - ((cumulative - minValue) / range) * chartH;
        points.push({ x, y });
      }

      doc.setDrawColor(brandRgb.r, brandRgb.g, brandRgb.b);
      doc.setLineWidth(0.8);
      for (let i = 1; i < points.length; i++) {
        doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
      }
      doc.setLineWidth(0.2);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      [0, 5, 10, 15, 20].forEach((year) => {
        const x = chartX + (year / 20) * chartW;
        doc.text(String(year), x - 2, chartY + chartH + 10);
      });
      doc.text("Années", chartX + chartW - 18, chartY + chartH + 10);

      const milestones = [1, 5, 10, 15, 20];
      let tableY = 177;
      doc.setFillColor(15, 23, 42);
      doc.rect(14, tableY, 182, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Année", 20, tableY + 6);
      doc.text("Production", 55, tableY + 6);
      doc.text("Gain annuel", 97, tableY + 6);
      doc.text("Gain cumulé", 145, tableY + 6);

      tableY += 15;
      milestones.forEach((year, idx) => {
        const cumulative = currentScenario.ecoAnnuelle * year - coutInstallation;
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, tableY - 5, 182, 11, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.8);
        doc.setTextColor(71, 85, 105);
        doc.text(String(year), 20, tableY);
        doc.text(`${Math.round(currentScenario.prod).toLocaleString("fr-FR")} kWh`, 55, tableY);
        doc.text(`~${Math.round(currentScenario.ecoAnnuelle).toLocaleString("fr-FR")} €`, 97, tableY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(cumulative >= 0 ? 5 : 225, cumulative >= 0 ? 150 : 29, cumulative >= 0 ? 105 : 72);
        doc.text(`${cumulative >= 0 ? "+" : ""}${Math.round(cumulative).toLocaleString("fr-FR")} €`, 145, tableY);
        tableY += 12;
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(split("Projection simplifiée à prix constants. Elle ne prend pas en compte tous les paramètres économiques, fiscaux, réglementaires, maintenance, financement, dégradation des modules ou évolution réelle des tarifs.", 175), 14, 258);

      renderFooter(4);

      // PAGE 5 — ASSUMPTIONS & LIMITS
      doc.addPage();
      renderHeader("HYPOTHÈSES & MÉTHODOLOGIE", "À lire avant utilisation");
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Sources et paramètres du simulateur", 14, 46);

      const assumptions = [
        ["Données solaires", "PVGIS 5.3 / JRC, interrogé à partir des coordonnées du site."],
        ["Pertes système", "14 % dans le calcul PVGIS du simulateur."],
        ["Tarif électricité achat", `${DEFAULT_PRICES.purchase.toFixed(2).replace(".", ",")} €/kWh dans le modèle actuel.`],
        ["Valorisation du surplus", `${DEFAULT_PRICES.surplus.toFixed(2).replace(".", ",")} €/kWh dans le modèle actuel.`],
        ["Autoconsommation", "Hypothèse simplifiée : jusqu'à 70 % de la production, plafonnée par la consommation annuelle."],
        ["Projection", "20 ans, avec gain annuel constant dans le modèle actuel."],
        ["CO₂", "Indicateur directionnel basé sur un facteur simplifié ; à utiliser comme ordre de grandeur."],
      ];

      let ay = 60;
      assumptions.forEach(([label, value], idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, ay - 6, 182, 22, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8);
        doc.setTextColor(15, 23, 42);
        doc.text(label, 20, ay);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.6);
        doc.setTextColor(71, 85, 105);
        doc.text(split(value, 120), 72, ay);
        ay += 24;
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("Limites du document", 14, 235);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const limitations = [
        "Ce document constitue une pré-étude indicative et ne remplace pas une étude technique d'exécution.",
        "Les résultats dépendent de l'orientation, de l'inclinaison, des ombrages, de l'équipement, des usages et des conditions réelles du site.",
        "Les hypothèses tarifaires et économiques doivent être vérifiées avant toute décision commerciale ou contractuelle.",
        "Les informations réglementaires ou de raccordement ne sont pas garanties par ce document.",
      ];
      let ly = 247;
      limitations.forEach((line) => {
        doc.text(`• ${line}`, 20, ly, { maxWidth: 170 });
        ly += 10;
      });

      renderFooter(5);

      const safeName = (nomClient || "projet").trim().replace(/[^\p{L}\p{N}\-_ ]/gu, "").replace(/\s+/g, "_").slice(0, 80);
      doc.save(`pre-etude-photovoltaique-${safeName || "projet"}.pdf`);
    } finally {
      setIsGeneratingPdf(false);
    }
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
              {companyConfig.companyName || "SOLAR ENERGIE"} <span className="text-zinc-400 font-normal">| Ingénierie PVGIS</span>
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-3 py-1.5 transition"
            >
              📁 Mes Projets
            </Link>
            <Link
              href="/settings"
              className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-3 py-1.5 transition"
            >
              ⚙️ Ma Société
            </Link>
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
        {/* TELA DE RESULTADO EM 1 PÁGINA */}
        {showOnePageResult ? (
          <div className="max-w-5xl mx-auto bg-white border border-zinc-200 rounded-3xl p-8 sm:p-12 shadow-sm mb-16 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-100 pb-8 mb-8 gap-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-blue-600 font-semibold block mb-1">
                  Étude réalisée par {companyConfig.companyName || "SOLAR ENERGIE"}
                </span>
                <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
                  VOTRE PROJET SOLAIRE
                </h1>
                <p className="text-zinc-500 text-sm mt-1">
                  Projet de M./Mme {nomClient} • {selectedAddress ? selectedAddress.label : addressInput}
                </p>
              </div>
              <div className="bg-zinc-950 text-white px-5 py-3 rounded-2xl text-center sm:text-right shadow-sm">
                <span className="text-[10px] text-zinc-400 uppercase font-mono block">Option active</span>
                <span className="text-2xl font-black text-blue-400 font-mono">{puissanceKw} kWc</span>
              </div>
            </div>

            {/* Grid 4 KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                <span className="text-xs text-zinc-500 block mb-1">☀️ Production</span>
                <div className="text-2xl font-black text-zinc-950 font-mono">
                  {Math.round(currentScenario.prod).toLocaleString("fr-FR")} <span className="text-xs font-normal text-zinc-400">kWh/an</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-100">
                <span className="text-xs text-blue-700 block mb-1">💰 Économies</span>
                <div className="text-2xl font-black text-blue-600 font-mono">
                  ~{Math.round(currentScenario.ecoAnnuelle).toLocaleString("fr-FR")} <span className="text-xs font-normal text-blue-400">€/an</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                <span className="text-xs text-zinc-500 block mb-1">📈 Temps de retour</span>
                <div className="text-2xl font-black text-zinc-950 font-mono">
                  {currentScenario.roi} <span className="text-xs font-normal text-zinc-400">ans</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-xs text-emerald-700 block mb-1">🌱 CO₂ évité (indicatif)</span>
                <div className="text-2xl font-black text-emerald-600 font-mono">
                  {currentScenario.co2} <span className="text-xs font-normal text-emerald-500">kg/an</span>
                </div>
              </div>
            </div>

            <div className="mb-10 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-950">Bilan énergétique estimé</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Répartition annuelle de la production photovoltaïque.</p>
                </div>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Hypothèse d'autoconsommation</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-zinc-200">
                <div className="bg-white p-5">
                  <span className="text-[11px] text-zinc-500 block mb-1">Énergie autoconsommée</span>
                  <span className="text-2xl font-black text-zinc-950 font-mono">{Math.round(currentScenario.autoconsoKwh).toLocaleString("fr-FR")} <span className="text-xs font-normal text-zinc-400">kWh/an</span></span>
                  <span className="text-[11px] text-blue-600 font-semibold block mt-1">{currentScenario.tauxAutoconsommation.toFixed(0)} % de la production</span>
                </div>
                <div className="bg-white p-5">
                  <span className="text-[11px] text-zinc-500 block mb-1">Surplus valorisable</span>
                  <span className="text-2xl font-black text-zinc-950 font-mono">{Math.round(currentScenario.surplusKwh).toLocaleString("fr-FR")} <span className="text-xs font-normal text-zinc-400">kWh/an</span></span>
                  <span className="text-[11px] text-zinc-500 block mt-1">Production non autoconsommée</span>
                </div>
                <div className="bg-white p-5">
                  <span className="text-[11px] text-zinc-500 block mb-1">Gain annuel estimé</span>
                  <span className="text-2xl font-black text-blue-600 font-mono">~{Math.round(currentScenario.ecoAnnuelle).toLocaleString("fr-FR")} <span className="text-xs font-normal text-zinc-400">€/an</span></span>
                  <span className="text-[11px] text-zinc-500 block mt-1">Autoconsommation + surplus</span>
                </div>
              </div>
            </div>

            {/* Comparativo de 3 Cenários */}
            <div className="mb-10">
              <h3 className="text-lg font-bold text-zinc-950 tracking-tight mb-4 flex items-center gap-2">
                <span>Comparatif des 3 scénarios de puissance</span>
                <span className="text-xs font-normal text-zinc-400 font-mono">(Données PVGIS)</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: "OPTION A", kw: 3, s: scenario3k },
                  { title: "OPTION B", kw: 6, s: scenario6k },
                  { title: "OPTION C", kw: 9, s: scenario9k },
                ].map((item) => {
                  const isSelected = puissanceKw === item.kw;
                  return (
                    <div
                      key={item.kw}
                      onClick={() => handlePuissanceChange(item.kw)}
                      className={`p-6 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-50/50 border-blue-600 shadow-sm ring-2 ring-blue-600/20"
                          : "bg-white border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-xs font-bold ${isSelected ? "text-blue-600" : "text-zinc-500"}`}>
                          {item.title}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] bg-blue-600 text-white font-medium px-2 py-0.5 rounded-full">
                            Sélectionné
                          </span>
                        )}
                      </div>

                      <div className="text-3xl font-black text-zinc-950 font-mono mb-4">
                        {item.kw} <span className="text-sm font-normal text-zinc-500">kWc</span>
                      </div>

                      <div className="space-y-2.5 text-xs border-t border-zinc-100 pt-3">
                        <div className="flex justify-between text-zinc-600">
                          <span>Investissement TTC :</span>
                          <span className="font-bold text-zinc-900 font-mono">{item.s.cost.toLocaleString("fr-FR")} €</span>
                        </div>
                        <div className="flex justify-between text-zinc-600">
                          <span>Production estimée :</span>
                          <span className="font-bold text-zinc-900 font-mono">{Math.round(item.s.prod).toLocaleString("fr-FR")} kWh</span>
                        </div>
                        <div className="flex justify-between text-zinc-600">
                          <span>Autoconsommée :</span>
                          <span className="font-bold text-zinc-900 font-mono">{Math.round(item.s.autoconsoKwh).toLocaleString("fr-FR")} kWh</span>
                        </div>
                        <div className="flex justify-between text-zinc-600">
                          <span>Surplus :</span>
                          <span className="font-bold text-zinc-900 font-mono">{Math.round(item.s.surplusKwh).toLocaleString("fr-FR")} kWh</span>
                        </div>
                        <div className="flex justify-between text-zinc-600">
                          <span>Économies / an :</span>
                          <span className="font-bold text-blue-600 font-mono">~{Math.round(item.s.ecoAnnuelle).toLocaleString("fr-FR")} €</span>
                        </div>
                        <div className="flex justify-between text-zinc-600">
                          <span>Temps de retour :</span>
                          <span className="font-bold text-zinc-900 font-mono">{item.s.roi} ans</span>
                        </div>
                        <div className="flex justify-between text-zinc-600 pt-2 border-t border-zinc-100">
                          <span>Gain cumulé estimé (20 ans) :</span>
                          <span className="font-bold text-emerald-600 font-mono">+{Math.round(item.s.gain20).toLocaleString("fr-FR")} €</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bilan 20 ans & Botão de Download */}
            <div className="p-6 rounded-2xl bg-zinc-950 text-white mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-xs text-zinc-400 uppercase font-mono">Gain financier cumulé de l&apos;option {puissanceKw} kWc</p>
                <p className="text-2xl sm:text-3xl font-black text-white font-mono mt-0.5">
                  +{Math.round(currentScenario.gain20).toLocaleString("fr-FR")} € <span className="text-xs font-normal text-emerald-400 font-sans">sur 20 ans</span>
                </p>
              </div>

              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-semibold py-3.5 px-6 rounded-xl transition text-sm shadow-md cursor-pointer"
              >
                {isGeneratingPdf ? "Édition du rapport..." : "Télécharger le rapport PDF (5 pages) →"}
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
                ← Modifier les paramètres de la simulation
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-3xl mb-12">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 mb-3">
                <span>Données solaires issues de PVGIS — Commission européenne</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-zinc-950 tracking-tight leading-[1.15] mb-4">
                Étude photovoltaïque de précision.
              </h1>
              <p className="text-zinc-500 text-base leading-relaxed">
                Importez une facture d&apos;électricité pour pré-remplir l&apos;étude automatiquement ou saisissez vos données manuelles.
              </p>
            </div>

            <div id="simulateur" className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start mb-24">
              <div className="lg:col-span-7">
                <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 sm:p-8 shadow-sm">
                  
                  {/* DROPZONE DE LEITURA INTELIGENTE DE FATURA */}
                  <div className="mb-8 p-5 bg-blue-50/50 border-2 border-dashed border-blue-200 rounded-2xl text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleBillUpload}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center">
                      <span className="text-2xl mb-1">⚡</span>
                      <p className="text-xs font-bold text-zinc-900">
                        {isParsingBill ? "Analyse de la facture en cours..." : "Pré-remplir avec une facture d'électricité"}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 max-w-sm">
                        Déposez une facture PDF (EDF, Engie, TotalEnergies...) pour extraire l&apos;adresse, le titulaire et la consommation annuelle.
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isParsingBill}
                        className="mt-3 bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 font-semibold px-4 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-2xs"
                      >
                        {isParsingBill ? "Extraction..." : "Choisir une facture (PDF)"}
                      </button>
                    </div>

                    {/* CARD VISUAL DE FEEDBACK DOS DADOS EXTRAÍDOS */}
                    {extractedBillData && (
                      <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-left animate-in fade-in duration-200">
                        <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs mb-2">
                          <span>✓</span>
                          <span>{extractedBillData.conso ? "Données extraites depuis la facture :" : "Informations détectées dans la facture :"}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-700">
                          <div>
                            <span className="text-zinc-400 block text-[10px]">Titulaire détecté :</span>
                            <span className="font-semibold text-zinc-900">{extractedBillData.nom}</span>
                          </div>
                          <div>
                            <span className="text-zinc-400 block text-[10px]">Consommation annuelle :</span>
                            <span className="font-bold text-blue-700 font-mono">{extractedBillData.conso?.toLocaleString("fr-FR")} kWh / an</span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-zinc-400 block text-[10px]">Lieu de consommation :</span>
                            <span className="font-semibold text-zinc-900 truncate block">{extractedBillData.adresse}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-2.5 text-xs font-semibold">
                      <span className={currentStep >= 1 ? "text-blue-600" : "text-zinc-400"}>
                        01. Adresse & Gisement
                      </span>
                      <span className={currentStep >= 2 ? "text-blue-600" : "text-zinc-400"}>
                        02. Puissance
                      </span>
                      <span className={currentStep >= 3 ? "text-blue-600" : "text-zinc-400"}>
                        03. Coordonnées
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

                      {pvgisError && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                          <strong>PVGIS :</strong> {pvgisError}
                        </div>
                      )}

                      {errorMsg && currentStep === 1 && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                          {errorMsg}
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
                          onClick={() => {
                            if (!selectedAddress) {
                              setErrorMsg("Sélectionnez une adresse proposée afin d'utiliser les données PVGIS du site.");
                              return;
                            }
                            if (pvgisError || isLoadingPvgis) return;
                            setErrorMsg("");
                            setCurrentStep(2);
                          }}
                          disabled={isLoadingPvgis || !!pvgisError}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm shadow-sm cursor-pointer"
                        >
                          {isLoadingPvgis ? "Analyse du site..." : "Étape suivante →"}
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
                          Vos coordonnées
                        </h2>
                        <p className="text-xs text-zinc-500">
                          Renseignez vos coordonnées pour afficher le comparatif complet en 1 page.
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
                              Adresse e-mail
                            </label>
                            <input
                              type="email"
                              placeholder="jean.dupont@exemple.fr"
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
                          {isSaving ? "Chargement..." : "Afficher le Comparatif →"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dashboard Numérico */}
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
                        {Math.round(currentScenario.prod).toLocaleString("fr-FR")}
                      </div>
                      <span className="text-[10px] text-zinc-400">kWh / an</span>
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                      <span className="text-[11px] font-medium text-zinc-500 block mb-1">Économies</span>
                      <div className="text-2xl font-black text-blue-600 font-mono tracking-tight">
                        ~{Math.round(currentScenario.ecoAnnuelle).toLocaleString("fr-FR")} €
                      </div>
                      <span className="text-[10px] text-zinc-400">par an</span>
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                      <span className="text-[11px] font-medium text-zinc-500 block mb-1">Temps de retour</span>
                      <div className="text-2xl font-black text-zinc-950 font-mono tracking-tight">
                        {currentScenario.roi}
                      </div>
                      <span className="text-[10px] text-zinc-400">années</span>
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                      <span className="text-[11px] font-medium text-zinc-500 block mb-1">CO₂ évité (indicatif)</span>
                      <div className="text-2xl font-black text-emerald-600 font-mono tracking-tight">
                        {currentScenario.co2}
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
                      +{Math.round(currentScenario.gain20).toLocaleString("fr-FR")} €
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
                Estimation du productible à partir des données PVGIS disponibles pour la localisation du projet.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 font-bold text-lg">
                📊
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-2">
                Comparateur 3 Scénarios
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
                Présentez 3 options de puissance sur une même page pour faciliter la comparaison pendant le rendez-vous.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 font-bold text-lg">
                📑
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-2">
                Rapport de pré-étude White-Label
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
                Exportez un rapport professionnel de 5 pages personnalisé avec le nom, le logo et les coordonnées de votre entreprise.
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
              <h3 className="text-base font-bold text-zinc-900 mb-2">Votre facture ou adresse</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Importez une facture ou indiquez l&apos;adresse du bien pour extraire les coordonnées.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm relative">
              <span className="text-xs font-mono font-bold text-blue-600 block mb-3">02</span>
              <h3 className="text-base font-bold text-zinc-900 mb-2">Calcul PVGIS</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Le simulateur interroge PVGIS pour estimer le productible du site à partir de sa localisation.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm relative">
              <span className="text-xs font-mono font-bold text-blue-600 block mb-3">03</span>
              <h3 className="text-base font-bold text-zinc-900 mb-2">Comparatif</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Découvrez le comparatif financier détaillé entre 3, 6 et 9 kWc.
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm relative">
              <span className="text-xs font-mono font-bold text-blue-600 block mb-3">04</span>
              <h3 className="text-base font-bold text-zinc-900 mb-2">Étude White-Label</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Éditez et téléchargez un rapport de pré-étude photovoltaïque de 5 pages.
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
              Obtenez une première estimation comparative basée sur les données PVGIS en quelques étapes.
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
            {companyConfig.companyName || "SOLAR ENERGIE FRANCE"} • {companyConfig.siret ? `SIRET: ${companyConfig.siret}` : "Ingénierie Solaire"}
          </p>
          <p className="text-zinc-400">
            Étude indicative établie selon les standards d&apos;ingénierie et barèmes de rachat 2026.
          </p>
        </div>
      </footer>
    </div>
  );
}