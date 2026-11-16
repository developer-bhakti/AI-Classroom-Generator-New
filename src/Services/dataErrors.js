// Turns what the database said into one clear sentence for the screen. Several pages used to add
// "Run the latest supabase/schema.sql" to EVERY error, which sent people to the wrong fix (an expired sign-in
// is not a missing table).

const EXPIRED_SIGN_IN = /jwt expired|invalid jwt|jwt is expired/i;
const MISSING_TABLE = /could not find the table|schema cache|relation .* does not exist|PGRST205|42P01/i;

/**
 * @param message  the error text
 * @param missing  what a missing table would mean for this page, e.g. "the student tables" (adds the schema.sql hint
 *                 only when the error really is a missing table)
 */
export const explainDataError = (message, { missing } = {}) => {
  const text = String(message || "").trim().replace(/\.$/, "");
  if (!text) return "Something went wrong. Please try again.";
  if (EXPIRED_SIGN_IN.test(text)) return "Your sign-in has expired. Please log out and log in again.";
  if (missing && MISSING_TABLE.test(text)) return `${text}. Run the latest supabase/schema.sql so ${missing} exist${/s$/.test(missing) ? "" : "s"}.`;
  return text;
};
