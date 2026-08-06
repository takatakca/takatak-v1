# TAKATAK V1 — Deployment Guide (Vercel + Supabase)

1. **GitHub:** push this repository; protect `main`; CI must pass before merge.
2. **Supabase project:** create (region near Montréal, e.g. `ca-central`/us-east). Collect: Project URL, anon key, DB connection strings (pooled → `DATABASE_URL`, direct → `DIRECT_URL`).
3. **Vercel project:** import the repo. Build command `npm run build` (default). Node 22.
4. **Environment variables (Vercel → Production):** `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Leave `TAKATAK_FOUNDATION_MODE_ENABLED`, `ALLOW_FOUNDATION_SEED`, `HEALTH_DETAILS_ENABLED` **unset or false**. Add provider keys only after official docs + verified tests.
5. **Migrations:** from a trusted machine/CI with production `DATABASE_URL`+`DIRECT_URL`: `npm run db:deploy` (never `migrate dev` against production).
6. **RLS:** apply `supabase/sql/001…007` in order via the Supabase SQL editor. Review each file first.
7. **Auth config (Supabase → Authentication → URL configuration):** Site URL = production domain; add redirect URLs `https://<domain>/auth/callback` (+ staging/preview equivalents).
8. **Custom domain:** add the TAKATAK domain in Vercel; confirm HTTPS; then consider enabling HSTS at the platform level.
9. **Post-deploy checks:** `/` 200 · `/login` 200 · `/dashboard` unauthenticated → redirected to login (NOT foundation mode) · `/api/health` returns the minimal `{status,app}` · security headers present · GET `/auth/signout` 405 · provider APIs 401 when signed out.
10. **Do NOT seed:** the production guard skips foundation seed by default. Never set `ALLOW_FOUNDATION_SEED=true` on a customer database.
