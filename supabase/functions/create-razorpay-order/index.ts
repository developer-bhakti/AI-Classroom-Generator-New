import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

  if (!razorpayKeyId || !razorpayKeySecret) {
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

  let planId: string;
  try {
    const body = await req.json();
    planId = body.plan_id;
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  if (!planId) {
    return jsonResponse({ error: "plan_id is required." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("id, code, name, duration_months, price_inr")
    .eq("id", planId)
    .eq("is_active", true)
    .single();

  if (planError || !plan) {
    return jsonResponse({ error: "That plan is not available." }, 404);
  }

  const amountPaise = Math.round(Number(plan.price_inr) * 100);
  const receipt = `rcpt_${Date.now().toString(36)}_${user.id.slice(0, 8)}`;

  const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: { user_id: user.id, plan_id: plan.id, plan_code: plan.code }
    })
  });

  if (!razorpayResponse.ok) {
    const detail = await razorpayResponse.text();
    console.error("Razorpay order creation failed:", detail);
    return jsonResponse({ error: "Could not create the payment order. Try again." }, 502);
  }

  const order = await razorpayResponse.json();

  const { error: insertError } = await admin.from("payments").insert({
    user_id: user.id,
    plan_id: plan.id,
    razorpay_order_id: order.id,
    amount_inr: plan.price_inr,
    currency: "INR",
    status: "created"
  });

  if (insertError) {
    console.error("Failed to record payment row:", insertError);
    return jsonResponse({ error: "Could not start the payment. Try again." }, 500);
  }

  return jsonResponse({
    order_id: order.id,
    amount: amountPaise,
    currency: "INR",
    key_id: razorpayKeyId,
    plan_name: plan.name
  });
});
