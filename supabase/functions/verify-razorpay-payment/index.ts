import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const hmacSha256Hex = async (message: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

  if (!razorpayKeySecret) {
    return jsonResponse({ error: "Razorpay keys are not configured on the server." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization header." }, 401);
  }

  const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Not authenticated." }, 401);
  }

  let orderId: string;
  let paymentId: string;
  let signature: string;
  try {
    const body = await req.json();
    orderId = body.razorpay_order_id;
    paymentId = body.razorpay_payment_id;
    signature = body.razorpay_signature;
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  if (!orderId || !paymentId || !signature) {
    return jsonResponse({ error: "Missing payment details." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("id, user_id, plan_id, status")
    .eq("razorpay_order_id", orderId)
    .single();

  if (paymentError || !payment) {
    return jsonResponse({ error: "That payment order was not found." }, 404);
  }

  if (payment.user_id !== user.id) {
    return jsonResponse({ error: "This payment belongs to another account." }, 403);
  }

  // Razorpay signs `order_id|payment_id` with the key secret. Order matters.
  const expected = await hmacSha256Hex(`${orderId}|${paymentId}`, razorpayKeySecret);

  if (!timingSafeEqual(expected, signature)) {
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    return jsonResponse({ success: false, error: "Payment signature verification failed." }, 400);
  }

  if (payment.status === "paid") {
    const { data: existing } = await admin
      .from("subscriptions")
      .select("end_date, plans(name)")
      .eq("user_id", user.id)
      .single();
    return jsonResponse({
      success: true,
      already_processed: true,
      end_date: existing?.end_date ?? null
    });
  }

  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("id, name, duration_months")
    .eq("id", payment.plan_id)
    .single();

  if (planError || !plan) {
    return jsonResponse({ error: "Plan not found for this payment." }, 404);
  }

  await admin
    .from("payments")
    .update({
      status: "paid",
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      verified_at: new Date().toISOString()
    })
    .eq("id", payment.id);

  const { data: current } = await admin
    .from("subscriptions")
    .select("id, start_date, end_date")
    .eq("user_id", user.id)
    .maybeSingle();

  const now = new Date();
  const hasActiveTime = current && new Date(current.end_date) > now;
  // Renewing early must not forfeit remaining days.
  const base = hasActiveTime ? new Date(current.end_date) : now;
  const newEnd = new Date(base);
  newEnd.setMonth(newEnd.getMonth() + plan.duration_months);

  const { error: subError } = await admin.from("subscriptions").upsert(
    {
      user_id: user.id,
      plan_id: plan.id,
      status: "active",
      start_date: hasActiveTime && current ? current.start_date : now.toISOString(),
      end_date: newEnd.toISOString(),
      updated_at: now.toISOString()
    },
    { onConflict: "user_id" }
  );

  if (subError) {
    console.error("Failed to update subscription:", subError);
    return jsonResponse({ error: "Payment verified but the subscription could not be updated." }, 500);
  }

  await admin.from("activity_log").insert({
    user_id: user.id,
    action: "subscription_renewed",
    metadata: { plan_id: plan.id, plan_name: plan.name, end_date: newEnd.toISOString() }
  });

  return jsonResponse({
    success: true,
    end_date: newEnd.toISOString(),
    plan_name: plan.name
  });
});
