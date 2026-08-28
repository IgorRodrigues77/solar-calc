import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://udowdkpuwuofdpjshzxl.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_qp4cYfsk6acBmvjiusJoAA_LmR-IP7o";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);