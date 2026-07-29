// The one place the app talks to Supabase with the service role key.
//
// The service role key bypasses Row Level Security, so it must NEVER
// reach the browser. The `server-only` import below makes the build
// fail loudly if any client component ever tries to import this file.
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill it in — see README."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false }, // server routes are stateless; no auth session to keep
  });
}

/** True once both Supabase env vars are set — lets pages show setup help instead of crashing. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
