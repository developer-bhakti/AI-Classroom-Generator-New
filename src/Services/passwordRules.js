// What a new password must satisfy. Pure (no network, nothing stored), so the page and the tests share it.
// The minimum matches sign-up and Supabase's own default.

export const MIN_PASSWORD_LENGTH = 6;

/**
 * Checks a password change. `requireCurrent` is false only for someone who arrived through a reset link
 * (they cannot know their old password). Returns the live checklist for the form and the first
 * problem to show when they submit.
 */
export const validatePasswordChange = ({ current = "", next = "", confirm = "", requireCurrent = true }) => {
  const rules = [
    { id: "length", label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: next.length >= MIN_PASSWORD_LENGTH },
    ...(requireCurrent ? [{ id: "different", label: "Different from your current password", met: next.length > 0 && current.length > 0 && next !== current }] : []),
    { id: "match", label: "Both new passwords match", met: next.length > 0 && next === confirm }
  ];

  let error = null;
  if (requireCurrent && !current) error = "Enter your current password.";
  else if (next.length < MIN_PASSWORD_LENGTH) error = `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (requireCurrent && next === current) error = "Your new password must be different from your current one.";
  else if (next !== confirm) error = "The two new passwords do not match.";

  return { ok: error === null, error, rules };
};

// A random password for an admin to give someone: no look-alike characters (0/O, 1/l/I), and always a mix.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export const generatePassword = (length = 12) => {
  const limit = 256 - (256 % ALPHABET.length); // discard bytes that would favour the first characters
  for (;;) {
    let out = "";
    while (out.length < length) {
      const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
      for (const byte of bytes) {
        if (byte < limit && out.length < length) out += ALPHABET[byte % ALPHABET.length];
      }
    }
    if (/[a-z]/.test(out) && /[A-Z]/.test(out) && /\d/.test(out)) return out;
  }
};

export const PASSWORD_EVENTS = ["password_changed", "password_set_by_admin", "password_reset_sent", "login"];

/**
 * What an admin can truthfully know about someone's password, from the activity log: when it was last
 * changed and how, when a reset link was last sent, and the last sign-in. The password itself is never
 * available: Supabase keeps only a one-way hash, so nobody can read it back.
 */
export const summarizePasswordActivity = (rows = []) => {
  const newest = (matches) => [...rows].filter(matches).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;

  const change = newest((row) => row.action === "password_changed" || row.action === "password_set_by_admin");
  const reset = newest((row) => row.action === "password_reset_sent");
  const login = newest((row) => row.action === "login");

  const howChanged = (row) => (row.action === "password_set_by_admin" ? "set by an admin" : row.metadata?.via === "reset_link" ? "by the user, using a reset link" : "by the user");

  return {
    lastChange: change ? { at: change.created_at, how: howChanged(change) } : null,
    lastResetSent: reset ? { at: reset.created_at } : null,
    lastLogin: login ? { at: login.created_at } : null
  };
};
