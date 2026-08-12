# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — production build (outputs to `dist/`)
- `npm run preview` — serve the production build locally
- `npm run lint` — run Oxlint (config in `.oxlintrc.json`)

There is no test runner configured in this project.

Requires a `.env` file (see `.env.example`) with:
- `VITE_GEMINI_API_KEY` — from https://aistudio.google.com/apikey (optional `VITE_GEMINI_MODEL`, defaults to `gemini-flash-latest`; optional `VITE_GEMINI_IMAGE_MODEL`, defaults to `gemini-3.1-flash-image`). **Gemini image models are not on the free tier** — their free-tier quota is literally 0, so worksheet-image generation 429s until billing is enabled on the key's Google Cloud project. Text generation is unaffected.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase Project Settings → API
- `VITE_RAZORPAY_KEY_ID` — Razorpay API keys (the Key **Secret** must never go here; see `supabase/README.md`)

The dev server must be restarted after changing `.env`.

## Architecture

This is a client-only React + Vite app (React 19, react-router-dom v7, Tailwind v4) that generates classroom teaching resources (worksheets, lesson plans, quizzes, activity ideas, exam papers) via the Gemini API. There is no backend — auth, history, and saved content all live in `localStorage`.

### Generation pipeline

Every generator page (`WorksheetGenerator`, `LessonGenerator`, `QuizGenerator`, `ActivityIdeas`, `ExamPaper`) follows the same flow:

1. Page collects form data and calls `generateResource({ type, formData })` from `src/Services/aiService.js`.
2. `aiService.js` looks up a prompt builder from `src/Services/promptBuilder.js` (one per resource type: `buildWorksheetPrompt`, `buildLessonPrompt`, `buildQuizPrompt`, `buildActivityPrompt`, `buildExamPrompt`) and builds the prompt text from the form data.
3. The prompt is sent to `generateStructuredContent()` in `src/Services/geminiService.js`, which calls the Gemini `generateContent` REST endpoint directly (no SDK) with a fixed `responseSchema` forcing JSON output shaped as `{ title, summary, sections: [{ heading, items[] }] }`. Response shape is validated manually (`validateShape`) before use.
4. `aiService.js` attaches a type-specific note (estimated time/difficulty) and returns `{ title, summary, sections, note, prompt }` to the page.
5. The page renders the result and can call `recordHistory()` / `saveContent()` from `src/Services/contentStore.js` to persist it.

To add a new resource type: add a prompt builder in `promptBuilder.js`, register it in `PROMPT_BUILDERS` (and `NOTE_BUILDERS`) in `aiService.js`, add an entry to `RESOURCE_TYPES` in `contentStore.js`, and wire up a page + route.

**Image output.** `WorksheetGenerator` has a second, parallel path: `generateResourceImage({ type, formData })` in `aiService.js` builds a *layout* prompt (`buildWorksheetImagePrompt`) and calls `generateImage()` in `geminiService.js`, which hits a Gemini image model and returns a base64 `data:` URL. Both paths share `postToGemini()`, so image calls raise the same typed errors and route through `describeGeminiError()`. Image mode is the page's default; the "Text worksheet" toggle restores the structured-JSON path. Only image mode exists for worksheets — extend `IMAGE_PROMPT_BUILDERS` to add more. Images are **not** persisted: `generated_content` stores text columns only, and a base64 page would be megabytes per row, so image results are session-only and offered as a download instead of a Save.

**Resource colour scheme.** `src/Services/resourcePalette.js` is the single source of truth, used by **all five generator pages**. `getResourcePalette({ className, subject, type })` composes three dimensions into one shade:
- **subject** → the hue family (Math → royal blue, Biology → emerald, …). `Social Studies` and `Social Science` both exist in the pages' `subjectMap`s and both must stay mapped.
- **class** → the shade within it, walking a lightness/saturation ramp plus a small hue drift from PG (bright pastel) to Class 12 (deep).
- **resource type** → a small hue offset (`TYPE_HUE_OFFSETS`, ±24° max) so a lesson plan and a quiz for the same class don't look identical.

All 880 type×class×subject combinations resolve to distinct hexes. Keep the type offsets small — larger values push a subject out of its recognisable hue family.

It returns three colours: `hex` (the shade), plus fixed-lightness `ink` (L24) and `glow` (L78) for text. Text must use `ink`/`glow` rather than mixing `hex` toward the foreground — `hex` ranges from very light to very dark across the ramp, so a mix-based text colour drops below contrast minimums at the light end (the amber/yellow subjects are the binding constraint). As tuned, the worst pair is 5.03:1 (light) and 5.77:1 (dark); re-run a full sweep after changing `LIGHTEST`/`DARKEST`/`ink`/`glow`.

Each page sets `--resource-accent` / `--resource-ink` / `--resource-glow` on its output card and adds `themed-output`; `.themed-output` in `index.css` uses them for the background tint, border, inset top bar, headings and note. Two gotchas: `.panel-card:hover` outranks `.themed-output`, so the inset bar is restated in `.themed-output:hover`; and `.exam-preview-card` sets its own `background`, so `.themed-output` only wins there because it is declared later in the file. Each page pins the palette at generation time (`outputPalette`) so editing the dropdowns afterwards can't re-tint output that's already on screen. `buildWorksheetImagePrompt` additionally feeds the colour name + hex + band tone into the image prompt.

Gemini error handling is centralized: `geminiService.js` throws typed errors (`GeminiConfigError`, `GeminiAuthError`, `GeminiRateLimitError`, `GeminiNetworkError`, `GeminiResponseError`), and `describeGeminiError()` converts them to a user-facing message. Generator pages catch errors from `generateResource` and render the result of `describeGeminiError(err)`.

### Auth, data, and payments (Supabase)

Auth is real Supabase auth. `AuthProvider` (`src/context/AuthContext.jsx`, mounted in `main.jsx` above `BrowserRouter`) owns `session`/`profile`/`loading` and exposes them via the `useAuth` hook in `src/context/useAuth.js` — the hook lives in its own file so the provider file only exports a component (React Fast Refresh requirement). `ProtectedRoute` gates on `session`; `AdminRoute` additionally requires `profile.role === "admin"`.

Schema, RLS policies, and Edge Functions live in `supabase/` — see `supabase/README.md` for the one-time setup (run `schema.sql`, disable email confirmation, set env vars, deploy functions, promote an admin). Tables: `profiles`, `plans`, `subscriptions`, `payments`, `activity_log`, `generated_content`.

**Access control:** the app is paywalled. `SubscriptionProvider` (`src/context/SubscriptionContext.jsx`) loads the user's subscription and exposes `isActive`, derived from `end_date > now()`. Routes passing `requireSubscription` to `ProtectedRoute` (`/worksheet`, `/lesson`, `/quiz`, `/activities`, `/exam`, `/saved`, `/history`) redirect to `/subscription` without one. `/dashboard`, `/subscription`, `/profile`, and `/settings` stay open. **Admins bypass the paywall entirely** — `isActive` returns true for them. `SubscriptionNag` re-opens a "buy a subscription" modal 10s after each dismissal; it is deliberately suppressed on `/subscription` itself, since otherwise it would cover the plan buttons and the Razorpay checkout window the user needs to reach.

Email confirmation and password-recovery links come back as `#access_token=...` in the URL. `supabaseClient.js` sets `detectSessionInUrl: true` so supabase-js consumes that hash into a session and strips it; turning it off makes a confirmed user land signed-out. `SignUp` passes `emailRedirectTo` derived from `window.location.origin`, but Supabase only honours origins listed under **Authentication → URL Configuration → Redirect URLs** — an unlisted origin silently falls back to Site URL (this is what sends production links to `localhost`). Branded email templates live in `supabase/email-templates/`.

`AuthContext` must not set `loading: false` until the profile (and therefore `role`) has resolved — `AdminRoute` reads `profile.role`, so flipping `loading` early makes a hard reload of `/admin` bounce an admin to `/dashboard`. Login routes admins to `/admin` and everyone else to `/dashboard`, reading the role directly from the DB rather than waiting on context.

Security invariants worth preserving:
- `payments` has **no client write policy** at all; it is written only by the Edge Functions using the service-role key. `subscriptions` is the same for regular users, but admins may write via the `subscriptions_admin_manage` policy — that check runs `is_admin()` inside Postgres, so it can't be spoofed from the client. Admin mutations live in `src/Services/adminService.js`.
- Subscription status is `active | paused | expired | cancelled`. Pausing stores `paused_at`; resuming adds the paused duration onto `end_date` so a pause never costs the user days. Use `describeSubscriptionStatus()`/`statusPillClass()` from `subscriptionService.js` rather than reading `status` directly, since "expired" is derived from `end_date`.
- `profiles` has a `prevent_role_self_escalation` trigger because RLS grants row access, not column access — without it a user could PATCH their own row to `role='admin'`.
- Policies that check admin-ness call the `SECURITY DEFINER` `is_admin()` function; querying `profiles` directly inside a `profiles` policy would recurse.
- The Razorpay key **secret** exists only as a Supabase Edge Function secret. Anything `VITE_`-prefixed ships in the browser bundle.
- `subscriptions.status` is never swept by a cron job, so active-ness is derived from `end_date > now()` via `isSubscriptionActive()` (`src/Services/subscriptionService.js`), not read from the column.

`contentStore.js` is a Supabase-backed external store following the same `subscribe`/`getSnapshot` pattern as `sidebarStore.js`, consumed via `useSyncExternalStore`. It caches rows in memory so `Navbar`'s search stays synchronous; `AuthContext` calls `initContentStore(userId)` on sign-in and `resetContentStore()` on sign-out (skipping the reset would leak one user's cache to the next on the same tab). Mutations (`recordHistory`, `saveContent`, `removeSavedContent`, `removeHistoryEntry`, `clearHistory`) are now **async** and update the cache optimistically. History and Saved are one row with an `is_saved` flag, so deleting from History is a hard delete that also removes it from Saved. `recordHistory` is the single choke point where `resource_generated` activity is logged, so the five generator pages don't each need to.

Theme and generation language remain in `localStorage` — they're device preferences, not account data. Theme (`light`/`dark`) is stored under `adiuvaret-theme` and applied via `data-theme` on `document.documentElement`; `App.jsx`, `Login.jsx`, `SignUp.jsx`, `Navbar.jsx`, and `Settings.jsx` each read/write it independently. Language (`adiuvaret-language`) is read by `aiService.js` to translate generated output.

### Routing and layout

All routes are defined in `src/App.jsx`. Every authenticated page wraps its content in `<ProtectedRoute>` (or `<AdminRoute>` for `/admin`) and renders the shared `Sidebar` + `Navbar` shell (see `WorksheetGenerator.jsx` for the canonical layout: `.app-shell` > `Sidebar` + `.main-panel` containing `Navbar` and a `.content-area`).

Note: `src/Pages/ExamPaperGenerator.jsx` exists but is not imported anywhere — `ExamPaper.jsx` is the page actually routed at `/exam`. Confirm which one is intended before editing exam-paper behavior.
