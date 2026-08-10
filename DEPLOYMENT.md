# Deploying to Apache / cPanel shared hosting

Live at: https://ai-classroom-generator.adiuvaretfoundation.com

## Build and upload

```bash
npm run build
```

Upload the **contents** of `dist/` into your web root (usually `public_html/`) — not the
`dist` folder itself. You should end up with `public_html/index.html`,
`public_html/assets/`, and `public_html/.htaccess` side by side.

`.htaccess` is the file that makes routing work. It is generated from
[`public/.htaccess`](public/.htaccess) and copied into `dist/` automatically on build.

> **FTP clients hide dotfiles by default.** If `/signup` 404s after a deploy, the most
> likely cause is that `.htaccess` was never uploaded. In FileZilla: Server → Force
> showing hidden files. In cPanel File Manager: Settings → Show Hidden Files.

## Why `.htaccess` is needed

React Router handles `/signup`, `/dashboard`, `/admin` in the browser. Apache doesn't know
those paths exist as files, so a direct visit or a page refresh returns 404. The rewrite
rule serves `index.html` for anything that isn't a real file, and the app takes it from
there.

It also stops `index.html` from being cached. Without that, returning visitors keep loading
an old build that references asset filenames deleted by the latest deploy — a blank page
that only a hard refresh fixes.

## Environment variables

Vite inlines `VITE_*` values into the bundle **at build time**. There is no `.env` on the
server — set them locally (or in your CI) *before* running `npm run build`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_RAZORPAY_KEY_ID=...
VITE_GEMINI_API_KEY=...
```

Rebuild and re-upload after changing any of them. **Never upload `.env` itself** — the
`.htaccess` blocks serving it, but it has no reason to be on the server at all.

> These keys ship inside the JavaScript bundle and are readable by anyone who views source.
> That is expected for the Supabase anon key (row-level security is the real boundary) and
> the Razorpay Key ID. It is **not** acceptable for the Razorpay Key **Secret** or the
> Supabase service-role key — those belong only in Supabase Edge Function secrets.
>
> The Gemini key is a genuine exposure: anyone can extract it from the bundle and spend
> your quota. Restrict it in Google AI Studio / Cloud Console to your domain, keep a
> billing cap on it, or proxy Gemini through an Edge Function the way Razorpay already is.

## After deploying, check Supabase URL settings

Dashboard → **Authentication → URL Configuration**:

- **Site URL** → `https://ai-classroom-generator.adiuvaretfoundation.com`
- **Redirect URLs** → include both the production domain and `http://localhost:5173/**`

Confirmation emails use these. If the production domain isn't listed, links fall back to
Site URL — which is what sends people to `localhost:3000`.

## Smoke test after each deploy

1. Visit `/signup` **directly** (not by clicking through) — it should load, not 404.
2. Refresh while on `/dashboard` — should stay put, not 404 or log you out.
3. Sign up with a real address, click the emailed link — it should land on the live domain
   and sign you in.
4. Log in as the admin account — should go straight to `/admin`.
5. Open a generator without a subscription — should bounce to `/subscription`.

## If the site 500s right after upload

Shared hosts vary in what they allow in `.htaccess`. Remove these one at a time, from the
bottom of the file up:

1. `Options -Indexes` — the most commonly forbidden directive.
2. The `<IfModule mod_headers.c>` block.
3. The `<IfModule mod_expires.c>` block.

The `mod_rewrite` block is the only part that is actually required for routing.
