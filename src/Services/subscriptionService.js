import { supabase } from "./supabaseClient";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    document.body.appendChild(script);
  });

export const getPlans = async () => {
  const { data, error } = await supabase
    .from("plans")
    .select("id, code, name, duration_months, price_inr")
    .eq("is_active", true)
    .order("duration_months", { ascending: true });

  if (error) throw new Error("Couldn't load the subscription plans.");
  return data || [];
};

export const getMySubscription = async (userId) => {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, status, start_date, end_date, plan_id, plans(name, code, duration_months, price_inr)")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Couldn't load subscription:", error.message);
    return null;
  }
  return data;
};

export const getMyPayments = async (userId) => {
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount_inr, status, created_at, verified_at, plans(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.warn("Couldn't load payment history:", error.message);
    return [];
  }
  return data || [];
};

// The stored status column is never swept by a cron job, so expiry is derived.
// Paused and cancelled subscriptions are deliberately not active.
export const isSubscriptionActive = (subscription) =>
  Boolean(subscription && subscription.status === "active" && new Date(subscription.end_date) > new Date());

export const describeSubscriptionStatus = (subscription) => {
  if (!subscription) return "None";
  if (subscription.status === "paused") return "Paused";
  if (subscription.status === "cancelled") return "Cancelled";
  return new Date(subscription.end_date) > new Date() ? "Active" : "Expired";
};

export const statusPillClass = (subscription) => {
  const label = describeSubscriptionStatus(subscription);
  if (label === "Active") return "active";
  if (label === "Paused") return "paused";
  if (label === "None") return "";
  return "expired";
};

export const formatINR = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount));

export const startCheckout = async ({ plan, user, profile, onSuccess }) => {
  await loadRazorpayScript();

  const { data: order, error: orderError } = await supabase.functions.invoke("create-razorpay-order", {
    body: { plan_id: plan.id }
  });

  if (orderError || order?.error) {
    throw new Error(order?.error || "Couldn't start the payment. Try again.");
  }

  return new Promise((resolve, reject) => {
    const razorpay = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id,
      name: "Adiuvaret",
      description: `${order.plan_name} subscription`,
      prefill: {
        name: profile?.full_name || "",
        email: profile?.email || user?.email || ""
      },
      theme: { color: "#4b7be5" },
      modal: {
        ondismiss: () => reject(new Error("Payment was cancelled."))
      },
      handler: async (response) => {
        const { data: verification, error: verifyError } = await supabase.functions.invoke(
          "verify-razorpay-payment",
          {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            }
          }
        );

        if (verifyError || !verification?.success) {
          reject(new Error(verification?.error || "We couldn't verify your payment. Contact support if you were charged."));
          return;
        }

        await onSuccess?.(verification);
        resolve(verification);
      }
    });

    razorpay.on("payment.failed", (response) => {
      reject(new Error(response?.error?.description || "Your payment failed. Please try again."));
    });

    razorpay.open();
  });
};
