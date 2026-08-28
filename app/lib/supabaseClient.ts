import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://udowdkpuwuofdpjshzxl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qp4cYfsk6acBmvjiusJoAA_LmR-IP7o";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);