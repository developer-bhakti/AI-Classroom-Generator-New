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

let client = null;
let refreshing = null;

const requestUrl = (input) => (typeof input === "string" ? input : input?.url || String(input));

// An access token that the server calls expired (the tab slept, or the computer's clock disagrees with the
// server's) used to leave every page showing "JWT expired". Now the first such answer triggers one refresh of the
// sign-in and the request is repeated with the new token. If the sign-in cannot be refreshed any more, the person
// is signed out so the app sends them to the login page, instead of showing an error they cannot act on.
export const fetchWithSignInRepair = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status !== 401 || !client || requestUrl(input).includes("/auth/v1/")) return response;

  const body = await response.clone().json().catch(() => null);
  if (!/jwt expired|invalid jwt/i.test(String(body?.message || ""))) return response;

  // Requests that fail together share one refresh.
  refreshing ||= client.auth.refreshSession().finally(() => { refreshing = null; });
  const { data, error } = await refreshing;

  if (error || !data?.session) {
    // Offline is not a reason to sign anyone out; a refresh token that is no longer valid is.
    if (error && error.name !== "AuthRetryableFetchError") await client.auth.signOut({ scope: "local" }).catch(() => {});
    return response;
  }

  const headers = new Headers(init?.headers || (typeof input === "string" ? undefined : input?.headers));
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
};

export const supabase = isSupabaseConfigured
  ? (client = createClient(url, anonKey, {
      global: { fetch: fetchWithSignInRepair },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Confirmation / recovery links come back as #access_token=... in the URL.
        // This consumes them into a session and strips the hash. Turning it off
        // makes a confirmed user land signed-out.
        detectSessionInUrl: true
      }
    }))
  : null;

// Where Supabase should send users after they click an email link. Derived from the
// current origin so localhost and the deployed domain each redirect to themselves —
// both must be listed under Authentication -> URL Configuration -> Redirect URLs.
export const emailRedirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
