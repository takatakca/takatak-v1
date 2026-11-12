# takatak.ca sign-in: email code or Google only (owner order 2026-11-12)

Signed: Claude (Anthropic) · 2026-11-12 · branch `claude/email-google-only-login`.

The owner ordered that no website offers phone-number sign-in for now: only an **email code** or **Google**, on takatak.ca and on r2nette.ca. This is a pause, not a deletion. It overrides the "phone-first" direction in `docs/mimt/README.md` until the owner says otherwise.

## What a customer sees

- `/login` and `/register`: one email field (**Send email code**), a **Continue with Google** button, no SMS tab, no mobile-number field. `/register` asks for the Terms and Privacy box before either method starts. `/login` shows a small "By continuing you accept…" line.
- Email: `POST /api/auth/email-code` (same-origin, stateless Supabase client, `signInWithOtp({ email, shouldCreateUser: true })`) → `/otp?email=…&provider=supabase-email` → the browser verifies with `supabase.auth.verifyOtp({ email, token, type: "email" })` → `POST /api/auth/sync-profile` creates or loads the profile → the page they came from (`next`). This is the same trust chain the phone path used.
- Google: `supabase.auth.signInWithOAuth({ provider: "google", redirectTo: <origin>/auth/callback?next=… })` → Google → the hub → the existing `/auth/callback` (`exchangeCodeForSession`, `ensureProfileForSupabaseUser`).
- A new address or a new Google account gets a profile and a personal workspace through the existing profile sync. Google users have no `first_name`/`last_name` metadata, so the profile shows the email name until they set one.

## Off, not removed

- `POST /api/auth/sms-login` and `/api/auth/sms-register` answer 410 unless `TAKATAK_PHONE_LOGIN=true`. The phone forms (`master-phone-*-form.tsx`) stay in the repo, unreferenced by the pages.
- Left alone on purpose: `/api/v1/auth/otp/*` (the master API other services such as MIMT call), the legacy `/api/auth/{login,verify-otp,resend-code}` routes (their phone branches already refuse), and the optional SMS notification features.
- Customers who only ever signed in with a phone number (no email on their identity) cannot sign in until the owner turns phone sign-in back on or they add an email.

## Owner steps in the TAKATAK Supabase dashboard

- **Authentication › URL Configuration › Redirect URLs** must allow `https://takatak.ca/auth/callback` (with a query string, e.g. `https://takatak.ca/auth/callback**`). The email links already use it; Google needs it too.
- **Authentication › Providers › Google** is on (4 Google users exist).
- The code email wording is the hub's Magic Link template; see `r2neet/docs/TAKATAK_INTEGRATION.md` for the per-site template (takatak.ca keeps the TAKATAK wording).

## Proof

- Local `next dev` against the hub's public settings: `/login` and `/register` show email and Google only, no SMS/mobile/phone words in the card, on a desktop and a phone; `/register` blocks without the terms; the Google button asks the hub for `provider=google` with a PKCE challenge and `redirect_to=<origin>/auth/callback?next=…`, and the hub sends the browser to accounts.google.com; a real email code (owner mailbox, never recorded) was accepted by the hub (`POST /auth/v1/verify` 200).
- **Not proven locally:** `/api/auth/sync-profile` and the rest of the profile and workspace creation (no database in this sandbox: it answered 503 as expected), and a full Google round trip (needs a Google account and the allowed redirect).
- `npm run test:auth` passes with new assertions; `npx tsc --noEmit` clean; ESLint clean on the changed files.
