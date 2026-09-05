// PUBLIC configuration — safe to expose in client-side code.
//
// The Supabase "anon" key is *designed* to be public: it only grants
// the access your Row Level Security policies allow (see
// supabase/schema.sql). It is NOT a secret.
//
// The VAPID public key is likewise safe to expose — it's how the
// browser verifies push messages actually came from your server.
//
// NEVER put a service_role key or a VAPID *private* key here or
// anywhere in client-side code. Those belong only in Supabase Edge
// Function secrets (see supabase/functions/send-reminders/index.ts).

export const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL"; // e.g. https://xxxxxxxx.supabase.co
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Replace with your own generated pair (see README → "Push notifications").
// A fresh pair was generated for you during setup — see the setup
// instructions for the actual values; do not reuse this placeholder.
export const VAPID_PUBLIC_KEY = "YOUR_VAPID_PUBLIC_KEY";
