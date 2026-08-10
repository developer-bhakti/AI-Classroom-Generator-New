import { supabase, isSupabaseConfigured } from "./supabaseClient";

export const ACTIVITY_LABELS = {
  login: "Signed in",
  signup: "Created account",
  resource_generated: "Generated a resource",
  subscription_renewed: "Renewed subscription",
  subscription_granted: "Subscription granted by admin",
  subscription_paused: "Subscription paused by admin",
  subscription_resumed: "Subscription resumed by admin",
  subscription_cancelled: "Subscription cancelled by admin",
  subscription_deleted: "Subscription deleted by admin"
};

// Fire-and-forget: logging must never block or fail the action it describes.
export const logActivity = async (userId, action, metadata = {}) => {
  if (!isSupabaseConfigured || !userId) return;

  const { error } = await supabase.from("activity_log").insert({
    user_id: userId,
    action,
    metadata
  });

  if (error) console.warn("Could not record activity:", error.message);
};
