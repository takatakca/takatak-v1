# BEH4VIOR / master dashboard bridge

BEH4VIOR code: https://github.com/takatakca/BEH4VIOR (counterpart: BEH4VIOR PR #1, `docs/TAKATAK_V1_BRIDGE.md` and `docs/DEPLOYMENT.md` there)

BEH4VIOR is an owner project (orders of 2026-11-10): a daily behaviour tracker for young children, shared between home and school. Target deployment for a private test: `https://beh4vior.takatak.ca`.

TAKATAK-V1 remains the **single master dashboard** for shared authentication, identity, subscriptions, entitlements and billing. BEH4VIOR is a separately deployed experience, launched the same way as Academy ([TAKATAK_ACADEMY_BRIDGE.md](TAKATAK_ACADEMY_BRIDGE.md)). The code below is a copy of the Academy bridge with its own product code and secrets.

## Routes

- `/dashboard/beh4vior`: authenticated dashboard entry (nav: Learning → BEH4VIOR). Uses `TAKATAK_BEH4VIOR_URL` to open BEH4VIOR's `/auth/start`. Shows a truthful "not connected" state when missing.
- `GET /api/experiences/beh4vior/launch?state=<43-character base64url>`: TAKATAK login with `next` preserved, profile sync, active master identity check, random 90-second one-time launch code hashed in `ExperienceLaunchCode`; state is forwarded only after validation to the configured callback.
- `POST /api/experiences/beh4vior/exchange`: bearer-secret protected JSON exchange, one-time atomic consumption, identity re-check. Returns `{ok:true,session:{masterIdentityId,displayName,productCode:"beh4vior",entitlements:["beh4vior_free"],expiresAt}}`.

Implementation: `src/lib/experiences/beh4vior-experience-access.ts`, `src/app/api/experiences/beh4vior/`, `src/app/dashboard/beh4vior/page.tsx`, one nav line in `src/lib/dashboard/dashboard-config.ts`, three names in `.env.example`.

One difference from Academy: the session returned by the exchange lasts 12 hours, not 10 minutes, because a parent keeps the tracker open through an evening. A deactivated account therefore loses BEH4VIOR access within 12 hours.

## Configuration

V1 runtime:
- `TAKATAK_BEH4VIOR_URL` = `https://beh4vior.takatak.ca`
- `BEH4VIOR_EXPERIENCE_CALLBACK_URL` = `https://beh4vior.takatak.ca/auth/callback`
- `TAKATAK_BEH4VIOR_SERVICE_TOKEN` = dedicated long random secret, identical in the BEH4VIOR deployment

No V1 migration: `ExperienceLaunchCode` already exists and `productCode` is a string. Free access only; no paid grant, subscription or new entitlement is provisioned.

## Hard boundary: no child data in V1

Children, sheets, goals and notes stay in BEH4VIOR's own database, keyed by `masterIdentityId`. V1 never receives or stores a child's name, score or note. The exchange returns the adult account context and nothing else.

## State

Written and locally checked (`tsc --noEmit` on the project, ESLint on the new and changed files, `qa:handoff`). **Not merged, not deployed, never run against a BEH4VIOR deployment.** Full CI and build are for the PR. Production needs the three variables, the BEH4VIOR deployment, and a real sign-in smoke test with two accounts (the second must see an empty tracker).

## Release guard

No direct V1 main change or production deploy by the agent. PR for owner/coordinator review under WORKLOG release rules.

— signed: Claude (Fable 5.2) @ claude.ai chat · 2026-11-11 00:45 EST
