import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://udowdkpuwuofdpjshzxl.supabase.co";
const supabaseAnonKey = "sb_publishable_qp4cYfsk6acBmvjiusJoAA_LmR-IP7o";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { data, error } = await supabase.from("leads_solaires").insert([
      {
        nom: body.nom,
        email: body.email,
        telephone: body.telephone,
        region: body.region,
        puissance_kw: body.puissance_kw,
        economie_annuelle: body.economie_annuelle,
        gain_20ans: body.gain_20ans,
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}