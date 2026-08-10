const SUPPORT_LINE =
  "Please contact our team at info@adiuvaret.in or call +91 80879 24064 / +91 91751 84064.";

export const describeAuthError = (error) => {
  if (!error) return "Something went wrong. Please try again.";

  const message = (error.message || "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return `Incorrect email or password. ${SUPPORT_LINE}`;
  }
  if (message.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }
  if (message.includes("user already registered") || message.includes("already been registered")) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (message.includes("password should be at least")) {
    return "Your password is too short. Use at least 6 characters.";
  }
  if (message.includes("unable to validate email") || message.includes("invalid email")) {
    return "That email address doesn't look valid.";
  }
  if (error.status === 429 || message.includes("rate limit")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Couldn't reach the server. Check your internet connection and try again.";
  }

  return error.message || "Something went wrong. Please try again.";
};
