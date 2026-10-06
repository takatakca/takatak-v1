# Facturations ↔ TAKATAK V1 integration

Facturations (`takatakca/Facturations`, `facturations.bolon.ca`) is the GROUPE TAKATAK invoicing system. It stays an **independent application with its own database**. TAKATAK V1 reads it **server-to-server only**, through the Facturations `/integration/v1` contract (`docs/takatak-dashboard-integration-handoff-v1.md` and `docs/takatak-integration-v1.openapi.json` in the Facturations repository).

## What is implemented (this branch)

- `src/lib/integrations/facturations/config.ts`: server env parsing, fail-closed (`disabled` → `not_configured` → `configured_untested`).
- `src/lib/integrations/facturations/token.ts`: mints the 60-second HS256 service token with the exact claims Facturations requires and a fresh `jti` per request.
- `src/lib/integrations/facturations/access.ts`: decides who may read billing data:
  - workspace `owner` → Facturations `OWNER`
  - workspace `admin` → Facturations `STAFF` (read-only drafts)
  - every other role → denied
  - The Facturations business id comes only from the server-side `FACTURATIONS_CLIENT_BUSINESS_MAP` for the **active** workspace. It is never taken from the browser.
- `src/lib/integrations/facturations/client.ts`: HTTP client.
  - Calls only two fixed GET paths (`/integration/v1/dashboard`, `/integration/v1/drafts`).
  - 8 s timeout, 256 KB response cap, no redirects, no cookies.
  - Validates every response field and refuses anything that is not draft-only CAD data for the requested business.
- `src/app/dashboard/invoices/page.tsx`: shows draft count, draft value and the latest drafts, with explicit "Drafts only — not issued, not revenue" labels.
  - While the integration is disabled, the page renders the same placeholder as before.

## What is deliberately not implemented

- No issuing, sending, paying, Wave writes or approval from TAKATAK. Facturations reports those capabilities as `false`; they stay in the standalone Facturations app behind explicit owner confirmation.
- No draft creation from TAKATAK yet (Facturations `POST /integration/v1/drafts` exists but needs `FACTURATIONS_INTEGRATION_WRITES_ENABLED=1` and an owner decision).
- No database tables were added to TAKATAK V1.

## Configuration (server only)

| Variable | Meaning |
| --- | --- |
| `FACTURATIONS_INTEGRATION_ENABLED` | Must be exactly `true` to activate |
| `FACTURATIONS_ORIGIN` | Exact HTTPS origin of Facturations (http loopback allowed only outside production) |
| `FACTURATIONS_INTEGRATION_HMAC_SECRET` | 32+ characters, identical on both servers |
| `FACTURATIONS_INTEGRATION_ISSUER` / `_AUDIENCE` | Must equal Facturations' configured issuer / audience |
| `FACTURATIONS_CLIENT_BUSINESS_MAP` | JSON `{"<takatak-client-uuid>":"<facturations-business-id>"}` |

## Verification

- `npm run qa:facturations` (runs in CI): 14 checks covering:
  - config fail-closed cases
  - token claims (mirrors the Facturations verifier)
  - role mapping and cross-workspace denial
  - fixed paths, bearer and no cookies
  - safe error mapping
  - response whitelisting
- A local cross-repo check also ran the V1 client against the real Facturations `createServer` with fake stores:
  - owner summary and drafts were read
  - a wrong secret, wrong business and wrong audience were each refused
  - STAFF read worked

  That check is not in CI because CI does not contain the Facturations code.

## Activation gate

Do not enable in production until Facturations has passed its own staging gate (HTTPS, dedicated PostgreSQL, least-privilege DB role, backup/restore proof). Then set identical secrets on both servers outside GitHub, map each workspace to its Facturations business, and test the negative paths on staging.

## Known limitation

A Facturations deployment currently serves **one** business (`WAVE_BUSINESS_ID`). Several TAKATAK workspaces can only point to that one business until Facturations gains multi-business support or one deployment per business is chosen.
