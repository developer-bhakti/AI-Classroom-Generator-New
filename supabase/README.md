# Supabase + Razorpay setup

Everything here runs on **your** Supabase project. Do these steps once, in order.

## 1. Create the database

Supabase dashboard → **SQL Editor** → New query → paste all of [`schema.sql`](schema.sql) → **Run**.

> **Already ran an earlier version?** Re-run the whole file. It is idempotent, and the
> current version adds the `paused_at` column, the `paused` status, and the policies that
> let admins manage subscriptions from the dashboard. Without re-running, the admin
> Pause/Grant controls will fail.

This creates `profiles`, `plans`, `subscriptions`, `payments`, `activity_log`,
`generated_content` (and the child-assessment tables below), plus row-level security policies, the
auto-profile trigger, and the four seed plans. It is safe to re-run.

> **Using Child Assessment, Syllabus or Students & Reports?** Run the whole file. It adds
> `students`, `assessments`, `student_topics`, `teaching_sessions`, `teacher_requests` and
> `syllabus_entries`, each with row-level security (a teacher sees only their own rows; the
> shared **School syllabus** an admin saves is readable by every teacher; admins also see every
> teacher request). If you ran an earlier version of this file it upgrades in place: new columns
> are added and `assessments.completed_month` is renamed to `month`, keeping its data. Until it
> has been run, those pages show a "run the latest schema.sql" message.

> **Exam answer keys.** The current file also adds `generated_content.answer_key`, where an exam's teacher-only answer key is stored apart from the student paper. Re-run `schema.sql` to add it; until then exam papers still save, but without their key.

**Edit the prices** at the bottom of `schema.sql` before running if you don't want the
placeholder amounts (₹499 / ₹1,299 / ₹2,399 / ₹4,299). Already ran it? Change them with:

```sql
update public.plans set price_inr = 599 where code = '1m';
```

## 2. Decide on email confirmation

Dashboard → **Authentication → Sign In / Providers → Email** → "Confirm email".

- **Off** — signup logs the user straight in. Fastest for testing.
- **On** — the user must click a link in their inbox first. Better for a public site.
  The app supports this: it shows a "check your inbox" message after signup, and the
  confirmation link signs them in automatically.

If you leave it on, step 3 below is mandatory.

## 2b. Set your URLs (required once you deploy)

**This is what makes confirmation links point at `localhost:3000` instead of your real
site.** The link uses Supabase's configured Site URL, not the domain the user signed up on.

Dashboard → **Authentication → URL Configuration**:

- **Site URL** → `https://ai-classroom-generator.adiuvaretfoundation.com`
- **Redirect URLs** → add both, one per line:
  ```
  https://ai-classroom-generator.adiuvaretfoundation.com/**
  http://localhost:5173/**
  ```

Keep the localhost entry so signup still works while developing. The app sends its own
`emailRedirectTo` based on whichever origin you signed up from, but Supabase only honours
values that match this allowlist — anything else silently falls back to Site URL.

## 2c. Brand the emails

Supabase's default emails are unstyled plain text. Ready-made HTML matching the app is in
[`email-templates/`](email-templates):

| File | Paste into Authentication → Emails → |
|---|---|
| `confirm-signup.html` | Confirm signup |
| `reset-password.html` | Reset password |
| `magic-link.html` | Magic Link |

Paste the file contents into the **Message body** field and save. Suggested subject lines
are in a comment at the top of each file. `{{ .ConfirmationURL }}` and `{{ .Email }}` are
Supabase variables — leave them exactly as they are.

> On Supabase's built-in email service, delivery is rate-limited (a few messages per hour)
> and messages often land in spam because they're sent from a shared domain. For real
> users, connect your own SMTP under **Project Settings → Authentication → SMTP Settings**.

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
supabase functions deploy admin-manage-user
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically — don't set those yourself.

`admin-manage-user` is what lets an admin change *another* person's account from the Admin
Dashboard: **Edit** (login email, name, account type, a new password) and **Delete**. Supabase only
allows those with the service-role key, so they cannot run in the browser. It needs no secrets of its
own, refuses anyone whose `profiles.role` is not `admin`, never lets you delete yourself or the last
admin, and never logs or returns a password. Until it is deployed, Edit's plan and end date still work
and **Send reset link** (which needs no function) still works; saving an email, name, role or password,
and Delete, say the service is not set up yet.

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

From **Edit** on any user row you can change the person's login email, name, account type, plan and subscription end date, **set a new password** or **send a password reset link** (they choose their own), and see their **User ID** (saving the first four needs step 4's `admin-manage-user` function). **Delete** removes the account. For a user you can also give or extend a subscription (pick a plan, adjust
the expiry date), pause it, resume it, cancel it, or delete it outright. Pausing records the
moment it stopped; resuming adds that time back onto the expiry, so a pause never costs the
user days. Admins are never paywalled themselves.

## 5b. Load the Class 2 Maths syllabus (optional)

[`seed-class2-math-syllabus.sql`](seed-class2-math-syllabus.sql) loads the Class 2 Maths textbook
(NCERT *Joyful Mathematics*, 14 chapters) as the shared **School syllabus**, so every teacher sees it
on the Syllabus page and Child Assessment builds its 20-question papers from it. Run it the same way
as `schema.sql` (SQL Editor -> paste -> Run), **after** `schema.sql` and after step 5, because the
rows are saved in an admin's name. It is safe to re-run: it never overwrites a month an admin has
edited. The textbook has no month plan, so the chapters follow the book's order from April; change any
month on the Syllabus page, or edit the file first. To add another class or subject, copy the file
and change `'Class 2'`, `'Math'` and the topic lists.

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
