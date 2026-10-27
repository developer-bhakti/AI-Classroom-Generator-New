import { supabase } from "./supabaseClient";
import { logActivity } from "./activityLog";
import { describeAuthError } from "./authErrors";
import { PASSWORD_EVENTS } from "./passwordRules";

const nowIso = () => new Date().toISOString();

// Every write below is gated by the `subscriptions_admin_manage` RLS policy,
// which evaluates is_admin() in Postgres — a non-admin call fails server-side.

export const grantSubscription = async ({ userId, planId, endDate, planName }) => {
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: planId,
      status: "active",
      end_date: endDate,
      paused_at: null,
      updated_at: nowIso()
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(error.message);
  await logActivity(userId, "subscription_granted", { plan_name: planName, end_date: endDate, by: "admin" });
};

export const pauseSubscription = async (subscription) => {
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "paused", paused_at: nowIso(), updated_at: nowIso() })
    .eq("id", subscription.id);

  if (error) throw new Error(error.message);
  await logActivity(subscription.user_id, "subscription_paused", { by: "admin" });
};

export const resumeSubscription = async (subscription) => {
  // Push the expiry out by however long it sat paused, so pausing never costs days.
  const pausedMs = subscription.paused_at
    ? Math.max(0, Date.now() - new Date(subscription.paused_at).getTime())
    : 0;
  const newEnd = new Date(new Date(subscription.end_date).getTime() + pausedMs).toISOString();

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "active", paused_at: null, end_date: newEnd, updated_at: nowIso() })
    .eq("id", subscription.id);

  if (error) throw new Error(error.message);
  await logActivity(subscription.user_id, "subscription_resumed", { end_date: newEnd, by: "admin" });
  return newEnd;
};

export const cancelSubscription = async (subscription) => {
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "cancelled", paused_at: null, updated_at: nowIso() })
    .eq("id", subscription.id);

  if (error) throw new Error(error.message);
  await logActivity(subscription.user_id, "subscription_cancelled", { by: "admin" });
};

export const deleteSubscription = async (subscription) => {
  const { error } = await supabase.from("subscriptions").delete().eq("id", subscription.id);
  if (error) throw new Error(error.message);
  await logActivity(subscription.user_id, "subscription_deleted", { by: "admin" });
};

// ---- Passwords (admin side) ----
// An admin never sets or sees anyone's password (that would need the service-role key, which must stay
// off the client). They email the person a reset link instead; the person chooses their own new password.

export const sendPasswordResetLink = async ({ userId, email }) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/password` });
  if (error) throw new Error(describeAuthError(error));
  await logActivity(userId, "password_reset_sent", { by: "admin" });
};

const MANAGE_SERVICE_MISSING =
  "The user-management service is not set up yet. Deploy the admin-manage-user function (supabase/README.md, step 4).";

// supabase-js hides an Edge Function's error body inside error.context (the raw Response).
const describeFunctionFailure = async (error, data) => {
  if (data?.error) return data.error;
  const response = error?.context;
  if (response?.status === 404) return MANAGE_SERVICE_MISSING;
  try {
    const body = await response.json();
    if (body?.error) return body.error;
  } catch {
    // no readable body: the function was not reachable at all
  }
  return MANAGE_SERVICE_MISSING;
};

// Everything below that changes ANOTHER user's account goes through the admin-manage-user Edge Function:
// it holds the service-role key and checks, from the caller's own token, that they really are an admin.
const manageUser = async (body) => {
  const { data, error } = await supabase.functions.invoke("admin-manage-user", { body });
  if (error || data?.error || !data?.ok) throw new Error(await describeFunctionFailure(error, data));
  return data;
};

/** Sets a user's password. It is sent once and never stored, logged or returned. */
export const setUserPassword = async ({ userId, password }) => {
  await manageUser({ action: "set_password", user_id: userId, password });
};

/** Edits a user's name, login email and/or role (pass only what should change). Returns the saved profile. */
export const updateUserDetails = async ({ userId, fullName, email, role }) => {
  const body = { action: "update", user_id: userId };
  if (fullName !== undefined) body.full_name = fullName;
  if (email !== undefined) body.email = email;
  if (role !== undefined) body.role = role;
  return (await manageUser(body)).profile;
};

/** Deletes the account and everything linked to it (the database cascades). The server refuses your own account and the last admin. */
export const deleteUserAccount = async (userId) => {
  await manageUser({ action: "delete", user_id: userId });
};

/**
 * Applies whatever the Edit window changed, one part at a time, so a failure in one part (say, an email
 * that is already taken) does not lose the others. Returns what was saved and what was not.
 */
export const applyUserEdits = async ({ user, profile, subscription, password }) => {
  const saved = [];
  const failed = [];
  const attempt = async (label, run) => {
    try {
      await run();
      saved.push(label);
    } catch (err) {
      failed.push({ label, message: err.message });
    }
  };

  if (profile && Object.keys(profile).length > 0) await attempt("account details", () => updateUserDetails({ userId: user.id, ...profile }));
  if (subscription) await attempt("subscription", () => grantSubscription({ userId: user.id, ...subscription }));
  if (password) await attempt("password", () => setUserPassword({ userId: user.id, password }));

  return { saved, failed };
};

/** The password-related entries of one user's activity log (admins may read everyone's; the rest is blocked by RLS). */
export const getPasswordActivity = async (userId) => {
  const { data, error } = await supabase
    .from("activity_log")
    .select("action, metadata, created_at")
    .eq("user_id", userId)
    .in("action", PASSWORD_EVENTS)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) throw new Error(error.message);
  return data || [];
};

// ---- Online teacher requests (admin side) ----
// Reads and updates are gated by the `teacher_requests_admin_manage` policy, like the subscription writes above.

export const listAllTeacherRequests = async () => {
  const { data, error } = await supabase
    .from("teacher_requests")
    .select("id, class_name, subject, areas, preferred_time, contact, note, status, created_at, students(name), teacher:profiles!teacher_id(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data || [];
};

export const updateTeacherRequestStatus = async (requestId, status) => {
  const { error } = await supabase
    .from("teacher_requests")
    .update({ status, updated_at: nowIso() })
    .eq("id", requestId);

  if (error) throw new Error(error.message);
};
