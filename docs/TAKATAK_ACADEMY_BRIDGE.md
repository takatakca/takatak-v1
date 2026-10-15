# TAKATAK Academy / master dashboard bridge

Academy code: https://github.com/takatakca/ACADEMYTAKATAK

TAKATAK-V1 remains the **single master dashboard** for shared authentication, identity, subscriptions, entitlements and billing. Academy's learning experience is separately deployed; it does not own customer identity or collect subscription payments.

## Routes

- `/dashboard/academy` — authenticated dashboard entry. Uses `TAKATAK_ACADEMY_URL` to open Academy's `/auth/start`. Displays a truthful "not configured" state when missing.
- `GET /api/experiences/academy/launch?state=<43-character base64url>` — authenticated TAKATAK login (with `next` preserved), profile sync, active master identity check, cryptographically random 90-second one-time launch code hashed in `ExperienceLaunchCode`; state is forwarded only after validation to the configured callback.
- `POST /api/experiences/academy/exchange` — bearer-secret protected JSON exchange, one-time atomic consumption, active master identity re-check and short-lived Academy session data. Returns `{ok:true,session:{masterIdentityId,displayName,productCode:"academy",entitlements:["academy_free"],expiresAt}}`.

## Configuration

V1 runtime secrets:
- `TAKATAK_ACADEMY_URL` (public Academy origin for dashboard link)
- `ACADEMY_EXPERIENCE_CALLBACK_URL` (HTTPS Academy origin + `/auth/callback`)
- `TAKATAK_ACADEMY_SERVICE_TOKEN` (dedicated long random server-side secret, identical in Academy deployment)

Academy runtime secrets:
- `TAKATAK_ACADEMY_LAUNCH_URL` = V1 origin + `/api/experiences/academy/launch`
- `TAKATAK_ACADEMY_EXCHANGE_URL` = V1 origin + `/api/experiences/academy/exchange`
- `TAKATAK_ACADEMY_SERVICE_TOKEN` = same dedicated secret
- `ACADEMY_SESSION_SECRET` = independent signing key
- `DATABASE_URL` for Academy progress

No V1 migration is introduced by this bridge: `ExperienceLaunchCode` already exists. The implementation deliberately issues **free-only** access; no paid grants, subscriptions or new entitlements are provisioned. To add paid access, integrate a verified Academy product catalog and paid/one-time purchase lifecycle into V1, including refunds and revocations, before returning `academy_plus` or `academy_course:<slug>`.

## Release guard

No direct V1 main change or production deploy. Submit a PR for owner/coordinator review under WORKLOG release rules. Production connection requires domain + secrets + deployed Academy service + real exchange smoke tests.
