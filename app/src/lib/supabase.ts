import { createClient } from "@supabase/supabase-js";

// Browser client — uses the ANON key only. Row Level Security (see
// supabase/migrations/001_schema.sql) is what protects the data: a
// patient session can read only its own rows, the admin role reads all.
// The service-role key NEVER ships to the browser; privileged work runs
// in Netlify Functions.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Surfaced in the console during development; production builds get
  // both values from Netlify environment variables.
  console.warn(
    "Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el entorno de build.",
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "");
