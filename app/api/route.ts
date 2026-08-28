import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://udowdkpuwuofdpjshzxl.supabase.co";

// Substitua pelo valor que você acabou de copiar (começa com eyJ...)
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkb3dka3B1d3VvZmRwanNoenhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MTYxMTEsImV4cCI6MjEwMzQ5MjExMX0.kWCJXyBJck277dCdA24MKMUBWhLL_ATNjFqF949zR0A";

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
      console.error("Erro Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: any) {
    console.error("Erro interno:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}