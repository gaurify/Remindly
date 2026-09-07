import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const isConfigured =
    typeof SUPABASE_URL === "string" &&
    SUPABASE_URL.startsWith("http") &&
    typeof SUPABASE_ANON_KEY === "string" &&
    !SUPABASE_ANON_KEY.startsWith("YOUR_");

// If js/config.js still has placeholder values, `supabase` is null
// instead of throwing a cryptic "Invalid URL" error deep in the
// Supabase SDK. Every page checks `isConfigured` before using it.
export const supabase = isConfigured
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
          },
      })
    : null;
