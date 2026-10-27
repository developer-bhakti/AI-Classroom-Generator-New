import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// A password-reset email link comes back as #access_token=...&type=recovery. supabase-js turns that hash
// into a session and strips it, so note it here, before the client is created, for the auth context.
export const arrivedViaRecoveryLink =
  typeof window !== "undefined" && /[#&?]type=recovery(?:&|$)/.test(`${window.location.hash}${window.location.search}`);

export const SUPABASE_SETUP_MESSAGE =
  "Supabase isn't configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then restart the dev server.";

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Confirmation / recovery links come back as #access_token=... in the URL.
        // This consumes them into a session and strips the hash. Turning it off
        // makes a confirmed user land signed-out.
        detectSessionInUrl: true
      }
    })
  : null;

// Where Supabase should send users after they click an email link. Derived from the
// current origin so localhost and the deployed domain each redirect to themselves —
// both must be listed under Authentication -> URL Configuration -> Redirect URLs.
export const emailRedirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
