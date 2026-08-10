import { supabase } from "./supabaseClient";
import { logActivity } from "./activityLog";

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
