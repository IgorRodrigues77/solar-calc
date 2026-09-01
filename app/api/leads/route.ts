import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[leads] Supabase variables manquantes.");
      return NextResponse.json({ success: false, error: "Service temporairement indisponible." }, { status: 503 });
    }

    const body = await request.json();

    const nom = typeof body.nom === "string" ? body.nom.trim() : "";
    if (!nom) {
      return NextResponse.json({ success: false, error: "Le nom du client est requis." }, { status: 400 });
    }

    const payload = {
      nom,
      email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
      telephone: typeof body.telephone === "string" && body.telephone.trim() ? body.telephone.trim() : null,
      adresse: typeof body.adresse === "string" && body.adresse.trim() ? body.adresse.trim() : null,
      region: typeof body.region === "string" ? body.region : null,
      societe: typeof body.societe === "string" ? body.societe : "SOLAR ENERGIE",
      productible_pvgis: Number.isFinite(Number(body.productible_pvgis)) ? Number(body.productible_pvgis) : null,
      puissance_kw: Number.isFinite(Number(body.puissance_kw)) ? Number(body.puissance_kw) : null,
      economie_annuelle: Number.isFinite(Number(body.economie_annuelle)) ? Number(body.economie_annuelle) : null,
      gain_20ans: Number.isFinite(Number(body.gain_20ans)) ? Number(body.gain_20ans) : null,
    };

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from("leads_solaires").insert([payload]);

    if (error) {
      console.error("[leads] Erreur Supabase:", error.message);
      return NextResponse.json({ success: false, error: "Impossible d'enregistrer l'étude." }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[leads] Exception:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Une erreur inattendue est survenue." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Cette ressource n'est pas accessible sans authentification." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
