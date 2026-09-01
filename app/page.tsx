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

const PVGIS_TIMEOUT_MS = 12000;
const DEFAULT_PRODUCTIBLE = 1100; // Moyenne France métropolitaine (kWh/kWc/an), utilisée en secours

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
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  // Dados Técnicos e Solares Reais (PVGIS)
  const [region, setRegion] = useState("Île-de-France / Nord");
  const [productible, setProductible] = useState(1050);
  const [pvgisError, setPvgisError] = useState("");
  const [pvgisIsFallback, setPvgisIsFallback] = useState(false);
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

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `[api-adresse.data.gouv.fr](https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(addressInput)}&limit=5)`,
          { signal: controller.signal }
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
      } catch (err: any) {
        if (err?.name !== "AbortError") console.error("Erreur API Adresse:", err);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [addressInput, selectedAddress]);

  const fetchPvgisData = async (lat: number, lon: number, kw: number) => {
    setIsLoadingPvgis(true);
    setPvgisError("");
    setPvgisIsFallback(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PVGIS_TIMEOUT_MS);

    try {
      const pvgisUrl = `[re.jrc.ec.europa.eu](https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=${lat}&lon=${lon}&peakpower=${kw}&loss=14&optimalinclination=1&outputformat=json)`;
      const res = await fetch(pvgisUrl, { signal: controller.signal });
      if (!res.ok) throw new Error(`PVGIS HTTP ${res.status}`);
      const data = await res.json();
      const annualYield = data?.outputs?.totals?.fixed?.E_y;
      if (typeof annualYield !== "number" || annualYield <= 0) {
        throw new Error("PVGIS n'a pas retourné une production annuelle exploitable.");
      }
      setProductible(Math.round(annualYield / kw));
    } catch (err: any) {
      const timedOut = err?.name === "AbortError";
      console.warn(timedOut ? "Timeout PVGIS:" : "Erreur PVGIS:", err);
      // On ne bloque plus le parcours commercial : on bascule sur une moyenne nationale
      // et on le signale clairement, avec la possibilité de réessayer.
      setProductible(DEFAULT_PRODUCTIBLE);
      setPvgisIsFallback(true);
      setPvgisError(
        timedOut
          ? "Le service PVGIS met trop de temps à répondre. Une valeur moyenne nationale a été utilisée à la place — vous pouvez réessayer ou continuer."
          : "Les données solaires du site n'ont pas pu être récupérées. Une valeur moyenne nationale a été utilisée à la place — vous pouvez réessayer ou continuer."
      );
    } finally {
      clearTimeout(timeoutId);
      setIsLoadingPvgis(false);
    }
  };

  const handleSelectAddress = (addr: AddressSuggestion) => {
    setPvgisError("");
    setPvgisIsFallback(false);
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

  // Résout l'adresse tapée sans exiger de clic sur une suggestion.
  // Appelée sur Entrée, sur perte de focus, et sur "Étape suivante".
  const resolveAddressInput = async (): Promise<boolean> => {
    if (selectedAddress && addressInput.trim() === selectedAddress.label) return true;

    const query = addressInput.trim();
    if (query.length < 3) {
      setErrorMsg("Veuillez saisir une adresse d'au moins 3 caractères.");
      return false;
    }

    if (suggestions.length > 0) {
      handleSelectAddress(suggestions[0]);
      return true;
    }

    setIsResolvingAddress(true);
    try {
      const res = await fetch(
        `[api-adresse.data.gouv.fr](https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1)`
      );
      const data = await res.json();
      if (data.features?.length > 0) {
        const f = data.features[0];
        handleSelectAddress({
          label: f.properties.label,
          postcode: f.properties.postcode,
          city: f.properties.city,
          context: f.properties.context,
          coordinates: f.geometry.coordinates,
        });
        return true;
      }
      setErrorMsg("Adresse introuvable. Vérifiez la saisie ou choisissez une suggestion dans la liste.");
      return false;
    } catch (err) {
      console.error("Erreur de résolution d'adresse:", err);
      setErrorMsg("Impossible de vérifier cette adresse pour le moment. Réessayez.");
      return false;
    } finally {
      setIsResolvingAddress(false);
    }
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
            `[api-adresse.data.gouv.fr](https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(data.adresse)}&limit=1)`
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
      do
