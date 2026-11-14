# SC4NNER / master dashboard bridge

SC4NNER code: https://github.com/takatakca/SC4NNER (counterpart: SC4NNER PR #1, merged 2026-11-14 as main `6ed186d2`; `docs/TAKATAK_V1_BRIDGE.md` and `DEPLOY.md` there)

SC4NNER is the TAKATAK label studio (first workshop client: MIEL AISSA): label templates, barcode checks and print-ready PDFs. Target deployment: `https://sc4nner.takatak.ca` (already live there on the workshop account; the TAKATAK login bridge is what this page adds).

TAKATAK-V1 remains the **single master dashboard** for shared authentication, identity, subscriptions, entitlements and billing. SC4NNER is a separately deployed experience, launched the same way as BEH4VIOR ([BEH4VIOR_BRIDGE.md](BEH4VIOR_BRIDGE.md)). The code below is a copy of the BEH4VIOR bridge with its own product code and secrets.

## Routes

- `/dashboard/sc4nner`: authenticated dashboard entry (nav: Services → SC4NNER). Uses `TAKATAK_SC4NNER_URL` to open SC4NNER's `/auth/start`. Shows a truthful "not connected" state when missing.
- `GET /api/experiences/sc4nner/launch?state=<43-character base64url>`: TAKATAK login with `next` preserved, profile sync, active master identity check, random 90-second one-time launch code hashed in `ExperienceLaunchCode`; state is forwarded only after validation to the configured callback.
- `POST /api/experiences/sc4nner/exchange`: bearer-secret protected JSON exchange, one-time atomic consumption, identity re-check. Returns `{ok:true,session:{masterIdentityId,displayName,productCode:"sc4nner",entitlements:["sc4nner_free"],expiresAt}}`.

Implementation: `src/lib/experiences/sc4nner-experience-access.ts`, `src/app/api/experiences/sc4nner/`, `src/app/dashboard/sc4nner/page.tsx`, one nav line in `src/lib/dashboard/dashboard-config.ts`, three names in `.env.example`.

Like BEH4VIOR, the session returned by the exchange lasts 12 hours: the workshop keeps the studio open through the day, and SC4NNER caps its own session at 12 hours as well. A deactivated account therefore loses SC4NNER access within 12 hours.

## Configuration

V1 runtime:
- `TAKATAK_SC4NNER_URL` = `https://sc4nner.takatak.ca`
- `SC4NNER_EXPERIENCE_CALLBACK_URL` = `https://sc4nner.takatak.ca/auth/callback`
- `TAKATAK_SC4NNER_SERVICE_TOKEN` = dedicated long random secret, identical in the SC4NNER deployment (Coolify, app `sc4nner`, as `TAKATAK_SC4NNER_LAUNCH_URL` / `TAKATAK_SC4NNER_EXCHANGE_URL` / `TAKATAK_SC4NNER_SERVICE_TOKEN` pointing back at `https://takatak.ca/api/experiences/sc4nner/...`). The values were prepared by Taktak on 2026-11-14 in a protected local file; no value is written in any repository.

No V1 migration: `ExperienceLaunchCode` already exists and `productCode` is a string. Free access only; no paid grant, subscription or new entitlement is provisioned.

## Hard boundary: no label data in V1

Products, label templates, barcodes and scan checks stay in SC4NNER's own database, keyed by `masterIdentityId`. V1 never receives or stores a product name, a barcode or a label. The exchange returns the account context and nothing else.

## State

Written by Taktak under the owner's full authorization of 2026-11-14 (owner order: finish SC4NNER end to end), locally checked (`tsc --noEmit` on the project, ESLint on the new and changed files). **Not merged, not deployed, never run against the SC4NNER deployment.** Full CI and build are for the PR. Production needs the three variables on both sides, redeploys, and a real sign-in smoke test with two accounts: sign up on takatak.ca, sign in to SC4NNER, save a label, sign back in (the label is still there), and a second account must not see it.

## Release guard

No direct V1 main change or production deploy by the agent. PR for owner/coordinator review under WORKLOG release rules.

— signed: Taktak @ Muse VM · 2026-11-14
