# Supabase + Razorpay setup

Everything here runs on **your** Supabase project. Do these steps once, in order.

## 1. Create the database

Supabase dashboard → **SQL Editor** → New query → paste all of [`schema.sql`](schema.sql) → **Run**.

> **Already ran an earlier version?** Re-run the whole file. It is idempotent, and the
> current version adds the `paused_at` column, the `paused` status, and the policies that
> let admins manage subscriptions from the dashboard. Without re-running, the admin
> Pause/Grant controls will fail.

This creates `profiles`, `plans`, `subscriptions`, `payments`, `activity_log`,
`generated_content`, plus row-level security policies, the auto-profile trigger, and
the four seed plans. It is safe to re-run.

**Edit the prices** at the bottom of `schema.sql` before running if you don't want the
placeholder amounts (₹499 / ₹1,299 / ₹2,399 / ₹4,299). Already ran it? Change them with:

```sql
update public.plans set price_inr = 599 where code = '1m';
```

## 2. Turn off email confirmation

Dashboard → **Authentication → Sign In / Providers → Email** → turn **off** "Confirm email" → Save.

Without this, a new signup can't log in until they click a confirmation email.

## 3. Fill in the client env vars

In `.env` at the project root (values from **Project Settings → API**):

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
```

Restart `npm run dev` afterwards — Vite only reads `.env` at startup.

> The anon key is **meant** to be public; row-level security is what protects your data.
> The Razorpay **Key Secret** and the Supabase **service role key** must never go in this
> file — anything with a `VITE_` prefix is compiled into the browser bundle.

## 4. Deploy the Edge Functions

These hold the Razorpay secret and are the only things allowed to write to
`subscriptions` and `payments`. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then:

```bash
supabase login
supabase link --project-ref <your-project-ref>

supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
supabase secrets set RAZORPAY_KEY_SECRET=your_key_secret

supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically — don't set those yourself.

No CLI? Dashboard → **Edge Functions → Deploy a new function**, paste each `index.ts`,
and set the two secrets under **Edge Functions → Secrets**. If you deploy via the
dashboard, inline the contents of `_shared/cors.ts` into each function, since the
dashboard editor is single-file.

## 5. Make yourself an admin

Sign up through the app's normal signup form first, then:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Sign out and back in. An **Admin Dashboard** entry appears in the sidebar, and logging in
as an admin takes you straight there.

From **Manage** on any user row you can give or extend a subscription (pick a plan, adjust
the expiry date), pause it, resume it, cancel it, or delete it outright. Pausing records the
moment it stopped; resuming adds that time back onto the expiry, so a pause never costs the
user days. Admins are never paywalled themselves.

## 6. Test a payment

Use Razorpay **test mode** keys and card `4111 1111 1111 1111`, any future expiry, any CVV.
Go to **Subscription**, pick a plan, pay, and confirm the status card flips to Active.

---

## How it fits together

- `create-razorpay-order` — verifies the caller's JWT, looks up the plan price
  server-side (so the client can't ask to pay ₹1), creates a Razorpay order, and
  records a `payments` row as `created`.
- `verify-razorpay-payment` — recomputes `HMAC-SHA256(order_id|payment_id)` with the
  key secret and compares it to Razorpay's signature. Only on a match does it mark the
  payment `paid` and extend the subscription. A forged success callback fails here.
- Renewing early **adds** to your remaining time rather than resetting it: the new end
  date is computed from `max(now, current end_date)`.

## Known gap

Payment confirmation depends on the browser reaching `verify-razorpay-payment` after
checkout. If the tab is closed at exactly the wrong moment, the charge succeeds but the
`payments` row stays `created` and the subscription isn't extended — recoverable by hand
in the dashboard. The robust fix is a Razorpay webhook, which is not built here.
