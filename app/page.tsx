"use client";

import { useState } from "react";
import jsPDF from "jspdf";

export default function Home() {
  const [consoAnnuelle, setConsoAnnuelle] = useState<number>(4800);
  const [prixKwh, setPrixKwh] = useState<number>(0.2516);
  const [region, setRegion] = useState<string>("Île-de-France / Nord");
  const [puissanceKw, setPuissanceKw] = useState<number>(3);
  const [coutInstallation, setCoutInstallation] = useState<number>(7500);

  const [nomClient, setNomClient] = useState<string>("");
  const [emailClient, setEmailClient] = useState<string>("");
  const [telClient, setTelClient] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const facteurRegion: Record<string, number> = {
    "Île-de-France / Nord": 950,
    "Ouest / Centre": 1100,
    "Sud-Ouest / Rhône-Alpes": 1250,
    "PACA / Occitanie": 1450,
  };

  const productible = facteurRegion[region] || 1100;
  const productionEstimee = puissanceKw * productible;

  const autoConsommee = Math.min(consoAnnuelle * 0.5, productionEstimee * 0.7);
  const surplusVendu = Math.max(0, productionEstimee - autoConsommee);
  const gainSurplus = surplusVendu * 0.13;
  const economieFacture = autoConsommee * prixKwh;
  const economieAnnuelle = economieFacture + gainSurplus;

  const payback = coutInstallation > 0 && economieAnnuelle > 0
    ? (coutInstallation / economieAnnuelle).toFixed(1)
    : "0";

  const gain20ans = (economieAnnuelle * 20) - coutInstallation;

  const handleValidationAndPDF = async () => {
    if (!nomClient || !emailClient) {
      alert("Veuillez renseigner au moins votre nom et e-mail.");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nomClient,
          email: emailClient,
          telephone: telClient,
          region: region,
          puissance_kw: puissanceKw,
          economie_annuelle: Math.round(economieAnnuelle),
          gain_20ans: Math.round(gain20ans),
        }),
      });

      if (response.ok) {
        setSaveSuccess(true);
      } else {
        console.error("Erreur API:", await response.text());
      }
    } catch (err) {
      console.error("Erreur d'envoi:", err);
    } finally {
      setIsSaving(false);
    }

    // Geração do PDF Profissional
    const doc = new jsPDF();

    // 1. Cabeçalho Escuro
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 38, "F");

    doc.setTextColor(245, 158, 11); // Âmbar / Amarelo solar
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("ÉTUDE DE FAISABILITÉ PHOTOVOLTAÏQUE", 14, 18);

    doc.setTextColor(203, 213, 225); // Slate 300
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Simulation prévisionnelle d'autoconsommation & rentabilité financière", 14, 26);
    doc.text(`Rapport émis le : ${new Date().toLocaleDateString("fr-FR")}`, 155, 26);

    // 2. Caixa: Dados do Cliente
    doc.setFillColor(248, 250, 252); // Fundo cinza claro
    doc.setDrawColor(226, 232, 240); // Borda suave
    doc.roundedRect(14, 46, 182, 32, 3, 3, "FD");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("INFORMATIONS BÉNÉFICIAIRE", 20, 54);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Client : ${nomClient}`, 20, 63);
    doc.text(`E-mail : ${emailClient}`, 20, 71);
    doc.text(`Téléphone : ${telClient || "Non renseigné"}`, 110, 63);
    doc.text(`Localisation : ${region}`, 110, 71);

    // 3. Caixa: Características Técnicas
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 84, 182, 38, 3, 3, "FD");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CONFIGURATION TECHNIQUE ESTIMÉE", 20, 92);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`• Puissance installée : ${puissanceKw} kWc`, 20, 101);
    doc.text(`• Consommation de référence : ${consoAnnuelle.toLocaleString("fr-FR")} kWh/an`, 20, 109);
    doc.text(`• Production annuelle estimée : ${productionEstimee.toFixed(0)} kWh/an`, 110, 101);
    doc.text(`• Investissement indicatif : ${coutInstallation.toLocaleString("fr-FR")} € TTC`, 110, 109);

    // 4. Três Destaques Financeiros (Cards coloridos)
    // Card 1: Économie / an
    doc.setFillColor(236, 253, 245); // Verde claro
    doc.setDrawColor(16, 185, 129);  // Verde
    doc.roundedRect(14, 130, 56, 32, 3, 3, "FD");
    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("ÉCONOMIE ANNUELLE", 18, 138);
    doc.setFontSize(14);
    doc.text(`~${economieAnnuelle.toFixed(0)} € / an`, 18, 151);

    // Card 2: Temps de retour
    doc.setFillColor(254, 243, 199); // Âmbar claro
    doc.setDrawColor(245, 158, 11);  // Âmbar
    doc.roundedRect(77, 130, 56, 32, 3, 3, "FD");
    doc.setTextColor(180, 83, 9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("RETOUR SUR INVEST.", 81, 138);
    doc.setFontSize(14);
    doc.text(`${payback} ans`, 81, 151);

    // Card 3: Gain 20 ans
    doc.setFillColor(238, 242, 255); // Azul índigo claro
    doc.setDrawColor(99, 102, 241);  // Azul índigo
    doc.roundedRect(140, 130, 56, 32, 3, 3, "FD");
    doc.setTextColor(67, 56, 202);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("GAIN NET (20 ANS)", 144, 138);
    doc.setFontSize(14);
    doc.text(`+${gain20ans.toFixed(0)} €`, 144, 151);

    // 5. Bloco de Explicação e Próximos Passos
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 172, 182, 45, 3, 3, "FD");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("PROCHAINES ÉTAPES RECOMMANDÉES :", 20, 181);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("1. Visite technique sur site pour vérifier l'orientation de toiture et le raccordement.", 20, 190);
    doc.text("2. Confirmation de l'éligibilité aux primes de l'État (Prime à l'autoconsommation).", 20, 197);
    doc.text("3. Validation du devis auprès d'un installateur certifié RGE QualiPV.", 20, 204);

    // 6. Rodapé
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Document à valeur informative fourni à titre indicatif selon les données déclarées.", 14, 280);
    doc.text("Solar Calc • Générateur d'études photovoltaïques", 145, 280);

    doc.save(`etude-solaire-${nomClient.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <span className="bg-amber-500/10 text-amber-400 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider border border-amber-500/20">
            Outil Professionnel
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-3">
            Simulateur Solaire Photovoltaïque ☀️
          </h1>
          <p className="mt-2 text-slate-400 text-sm max-w-xl mx-auto">
            Dimensionnez vos panneaux solaires et calculez la rentabilité financière en moins de 60 secondes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm space-y-6">
            <h2 className="text-lg font-semibold text-white border-b border-slate-700 pb-3">
              1. Paramètres Techniques
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">Région géographique</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="mt-1 block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                >
                  <option value="Île-de-France / Nord">Île-de-France / Nord</option>
                  <option value="Ouest / Centre">Ouest / Centre</option>
                  <option value="Sud-Ouest / Rhône-Alpes">Sud-Ouest / Rhône-Alpes</option>
                  <option value="PACA / Occitanie">PACA / Occitanie</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Puissance voulue</label>
                <select
                  value={puissanceKw}
                  onChange={(e) => {
                    const kw = Number(e.target.value);
                    setPuissanceKw(kw);
                    setCoutInstallation(kw === 3 ? 7500 : kw === 6 ? 12500 : 17500);
                  }}
                  className="mt-1 block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                >
                  <option value={3}>3 kWc (~6-8 panneaux)</option>
                  <option value={6}>6 kWc (~12-16 panneaux)</option>
                  <option value={9}>9 kWc (~18-24 panneaux)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Consommation annuelle (kWh)</label>
                <input
                  type="number"
                  value={consoAnnuelle}
                  onChange={(e) => setConsoAnnuelle(Number(e.target.value))}
                  className="mt-1 block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Coût installation (€ TTC)</label>
                <input
                  type="number"
                  value={coutInstallation}
                  onChange={(e) => setCoutInstallation(Number(e.target.value))}
                  className="mt-1 block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-white border-b border-slate-700 pb-3 pt-2">
              2. Vos Coordonnées (Obligatoire pour l&apos;Étude)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300">Nom complet *</label>
                <input
                  type="text"
                  placeholder="Jean Dupont"
                  value={nomClient}
                  onChange={(e) => setNomClient(e.target.value)}
                  className="mt-1 block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">E-mail *</label>
                <input
                  type="email"
                  placeholder="jean@exemple.fr"
                  value={emailClient}
                  onChange={(e) => setEmailClient(e.target.value)}
                  className="mt-1 block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">Téléphone</label>
                <input
                  type="tel"
                  placeholder="06 12 34 56 78"
                  value={telClient}
                  onChange={(e) => setTelClient(e.target.value)}
                  className="mt-1 block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-amber-500/30 flex flex-col justify-between shadow-xl">
            <div>
              <h2 className="text-xl font-bold text-amber-400 mb-6 flex items-center justify-between">
                <span>Bilan Estimé</span>
                <span className="text-xs bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full">20 ans</span>
              </h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-slate-700/60 pb-2.5">
                  <span className="text-slate-400">Production Solaire :</span>
                  <span className="font-semibold text-white">{productionEstimee.toFixed(0)} kWh / an</span>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-slate-700/60 pb-2.5">
                  <span className="text-slate-400">Économies Estimées :</span>
                  <span className="font-bold text-emerald-400 text-base">~{economieAnnuelle.toFixed(0)} € / an</span>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-slate-700/60 pb-2.5">
                  <span className="text-slate-400">Temps de Retour :</span>
                  <span className="font-bold text-amber-400">{payback} ans</span>
                </div>

                <div className="flex justify-between items-center text-sm pt-1">
                  <span className="text-slate-400">Bénéfice Net 20 ans :</span>
                  <span className="font-extrabold text-emerald-400 text-lg">+{gain20ans.toFixed(0)} €</span>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <button
                onClick={handleValidationAndPDF}
                disabled={isSaving}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isSaving ? "Enregistrement..." : "📄 Télécharger l'Étude (PDF)"}</span>
              </button>
              {saveSuccess && (
                <p className="text-xs text-center text-emerald-400 font-medium">
                  ✓ Demande enregistrée avec succès dans la base.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}