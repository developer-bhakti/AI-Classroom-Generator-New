import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

// Everything an admin does to ANOTHER user's account that only the service-role key can do (it must
// never reach the browser):
//   action "update"        - name, login email and role
//   action "set_password"  - a new password
//   action "delete"        - remove the account and everything linked to it
// The caller is verified from their own JWT and then looked up in `profiles`; the browser's claim about
// being an admin is never trusted. A password is used once: never logged, stored by us, or sent back.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["user", "admin"];
const MIN_PASSWORD_BYTES = 6;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores everything past 72 bytes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Use POST." }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization header." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Not authenticated." }, 401);
  }

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (caller?.role !== "admin") {
    return jsonResponse({ error: "Only an admin can manage other users." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const userId = body.user_id;
  if (typeof userId !== "string" || !UUID.test(userId)) {
    return jsonResponse({ error: "A valid user_id is required." }, 400);
  }

  const { data: target } = await admin.from("profiles").select("id, email, full_name, role").eq("id", userId).maybeSingle();
  if (!target) {
    return jsonResponse({ error: "That user was not found." }, 404);
  }

  // Never leave the app without an admin.
  const otherAdminExists = async () => {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").neq("id", userId);
    return (count ?? 0) > 0;
  };

  // ---------------------------------------------------------------- set_password
  if (body.action === "set_password") {
    const password = body.password;
    if (typeof password !== "string") {
      return jsonResponse({ error: "A password is required." }, 400);
    }
    const bytes = new TextEncoder().encode(password).length;
    if (bytes < MIN_PASSWORD_BYTES) {
      return jsonResponse({ error: `The password must be at least ${MIN_PASSWORD_BYTES} characters.` }, 400);
    }
    if (bytes > MAX_PASSWORD_BYTES) {
      return jsonResponse({ error: `The password must be at most ${MAX_PASSWORD_BYTES} characters.` }, 400);
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password });
    if (passwordError) {
      return jsonResponse({ error: passwordError.message }, 400);
    }

    // Only the fact of the change is recorded, never the password.
    await admin.from("activity_log").insert({ user_id: userId, action: "password_set_by_admin", metadata: { by: user.id } });
    return jsonResponse({ ok: true });
  }

  // ---------------------------------------------------------------- delete
  if (body.action === "delete") {
    if (userId === user.id) {
      return jsonResponse({ error: "You can't delete your own account." }, 400);
    }
    if (target.role === "admin" && !(await otherAdminExists())) {
      return jsonResponse({ error: "At least one admin must remain." }, 400);
    }

    // Profiles and everything linked to them (content, students, assessments, subscription, payments,
    // activity) are removed by the database's on delete cascade.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 400);
    }

    // The deleted user's own log went with them, so the record is kept against the admin who did it.
    await admin.from("activity_log").insert({
      user_id: user.id,
      action: "user_deleted",
      metadata: { deleted_id: userId, deleted_email: target.email }
    });
    return jsonResponse({ ok: true });
  }

  // ---------------------------------------------------------------- update
  if (body.action === "update") {
    const requested: { full_name?: string; email?: string; role?: string } = {};

    if (body.full_name !== undefined) {
      const name = typeof body.full_name === "string" ? body.full_name.trim().replace(/\s+/g, " ") : "";
      if (name.length < 1 || name.length > 100) {
        return jsonResponse({ error: "The name must be between 1 and 100 characters." }, 400);
      }
      requested.full_name = name;
    }
    if (body.email !== undefined) {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (email.length > 254 || !EMAIL.test(email)) {
        return jsonResponse({ error: "That email address doesn't look valid." }, 400);
      }
      requested.email = email;
    }
    if (body.role !== undefined) {
      if (typeof body.role !== "string" || !ROLES.includes(body.role)) {
        return jsonResponse({ error: "The role must be user or admin." }, 400);
      }
      requested.role = body.role;
    }
    if (Object.keys(requested).length === 0) {
      return jsonResponse({ error: "Nothing to change." }, 400);
    }

    // Keep only what really changes.
    const changes: { full_name?: string; email?: string; role?: string } = {};
    if (requested.full_name !== undefined && requested.full_name !== target.full_name) changes.full_name = requested.full_name;
    if (requested.email !== undefined && requested.email !== String(target.email).toLowerCase()) changes.email = requested.email;
    if (requested.role !== undefined && requested.role !== target.role) changes.role = requested.role;
    if (Object.keys(changes).length === 0) {
      return jsonResponse({ ok: true, profile: target });
    }

    if (changes.role === "user" && target.role === "admin") {
      if (userId === user.id) {
        return jsonResponse({ error: "You can't remove your own admin access. Ask another admin to do it." }, 400);
      }
      if (!(await otherAdminExists())) {
        return jsonResponse({ error: "At least one admin must remain." }, 400);
      }
    }

    if (changes.email) {
      const { data: taken } = await admin.from("profiles").select("id").eq("email", changes.email).neq("id", userId).maybeSingle();
      if (taken) {
        return jsonResponse({ error: "That email is already used by another account." }, 409);
      }
      // email_confirm: the admin vouches for the address, so no confirmation email is needed.
      const { error: authError } = await admin.auth.admin.updateUserById(userId, { email: changes.email, email_confirm: true });
      if (authError) {
        return jsonResponse({ error: authError.message }, 400);
      }
    }

    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update(changes)
      .eq("id", userId)
      .select("id, email, full_name, role")
      .single();

    if (updateError || !updated) {
      // The login email must never differ from the profile's: put it back.
      if (changes.email) {
        await admin.auth.admin.updateUserById(userId, { email: target.email, email_confirm: true });
      }
      return jsonResponse({ error: "Could not save the changes. Nothing was changed." }, 500);
    }

    // Which fields changed, never their values.
    await admin.from("activity_log").insert({
      user_id: userId,
      action: "user_edited",
      metadata: { by: user.id, fields: Object.keys(changes) }
    });

    return jsonResponse({ ok: true, profile: updated });
  }

  return jsonResponse({ error: "Unknown action." }, 400);
});
