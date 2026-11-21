# SC4NNER / master dashboard bridge

SC4NNER code: https://github.com/takatakca/SC4NNER (counterpart: SC4NNER PR #1, merged 2026-11-14 as main `6ed186d2`; `docs/TAKATAK_V1_BRIDGE.md` and `DEPLOY.md` there)

SC4NNER is the TAKATAK label studio (first workshop client: MIEL AISSA): label templates, barcode checks and print-ready PDFs. Target deployment: `https://sc4nner.takatak.ca` (already live there on the workshop account; the TAKATAK login bridge is what this page adds).

TAKATAK-V1 remains the **single master dashboard** for shared authentication, identity, subscriptions, entitlements and billing. SC4NNER is a separately deployed experience, launched the same way as BEH4VIOR ([BEH4VIOR_BRIDGE.md](BEH4VIOR_BRIDGE.md)). The code below is a copy of the BEH4VIOR bridge with its own product code and secrets.

## Routes

- `/dashboard/sc4nner`: authenticated dashboard entry (nav: Services → SC4NNER). Uses `TAKATAK_SC4NNER_URL` to open SC4NNER's `/auth/start`. Shows a truthful "not connected" state when missing.
- `GET /api/experiences/sc4nner/launch?state=<43-character base64url>`: TAKATAK login with `next` preserved, profile sync, then a redirect to the **authorize page** — this GET issues no code (see "Account step and provisioning" below).
- `GET /experiences/sc4nner/authorize?state=…`: the account step. Shows the identified account (email; phone for phone-first accounts), offers "Changer de compte" (`GET /api/experiences/sc4nner/switch`, sign-out → login with the launch as `next`), and posts the confirmation. No session → login (the login page offers account creation).
- `POST /api/experiences/sc4nner/launch/confirm`: same-origin form POST from the authorize page. Creates the random 90-second one-time launch code hashed in `ExperienceLaunchCode`, bound to the confirming identity, triggers that identity's provisioning, then redirects to the configured callback.
- `POST /api/experiences/sc4nner/exchange`: bearer-secret protected JSON exchange, one-time atomic consumption, identity re-check. Returns `{ok:true,session:{masterIdentityId,displayName,email,productCode:"sc4nner",entitlements:["sc4nner_free"],expiresAt}}` — `email` is the master identity's primary email (or null for phone-first accounts).

Implementation: `src/lib/experiences/sc4nner-experience-access.ts`, `src/lib/experiences/sc4nner-provisioning.ts`, `src/app/api/experiences/sc4nner/`, `src/app/experiences/sc4nner/authorize/page.tsx`, `src/app/dashboard/sc4nner/page.tsx`, one nav line in `src/lib/dashboard/dashboard-config.ts`, three names in `.env.example`.

## Account step and provisioning (2026-11-15, owner's order)

Owner's live finding (2026-11-15 10:51): the flow went straight to authorizing with no account choice, and the authorization was visibly attached to no email, client or signup; SC4NNER's `/api/release` also reported `account: "not_configured"` (that field only ever described the local workshop account variables). The missing link is built here:

- **Account before authorization.** The launch GET is now only a gate (session + profile sync + `sc4nnerAuthorizeDecision`): authorizing without an identified account is impossible, switching accounts rebinds the flow to the newly signed-in identity, and the confirmation creates the code for the shown account only.
- **Provider copy in the main database.** Confirming upserts `ProviderAccount` (new model + migration `20261115120000_provider_accounts`, RLS enabled like `ReversMembership`): one row per identity per source (`sc4nner`), email + display name captured once, `provisionStatus` (`pending` / `provisioned` / `failed`) and timestamps. This is the ecosystem provider registry — not a second identity system; `MasterIdentity` stays the authority, and no address or verification is required.
- **SC4NNER provisioning call.** Confirming also POSTs `{masterIdentityId,email,displayName,productCode,entitlement}` to SC4NNER's `/api/provision` (address derived from `SC4NNER_EXPERIENCE_CALLBACK_URL`, same service token, 8 s timeout, idempotent). Failure never blocks the authorization: the record keeps `provisionStatus: "failed"`, and the exchange still carries the email, from which SC4NNER feeds the same link. The exchange also refreshes the provider record for its identity.
- SC4NNER counterpart: `POST /api/provision` + `linked_accounts` (its migration 0003), `email` in `/api/session`, truthful `/api/release` (`account` + `linkedAccounts`). No new environment variable on either side.

Like BEH4VIOR, the session returned by the exchange lasts 12 hours: the workshop keeps the studio open through the day, and SC4NNER caps its own session at 12 hours as well. A deactivated account therefore loses SC4NNER access within 12 hours.

## Configuration

V1 runtime:
- `TAKATAK_SC4NNER_URL` = `https://sc4nner.takatak.ca`
- `SC4NNER_EXPERIENCE_CALLBACK_URL` = `https://sc4nner.takatak.ca/auth/callback`
- `TAKATAK_SC4NNER_SERVICE_TOKEN` = dedicated long random secret, identical in the SC4NNER deployment (Coolify, app `sc4nner`, as `TAKATAK_SC4NNER_LAUNCH_URL` / `TAKATAK_SC4NNER_EXCHANGE_URL` / `TAKATAK_SC4NNER_SERVICE_TOKEN` pointing back at `https://takatak.ca/api/experiences/sc4nner/...`). The values were prepared by Taktak on 2026-11-14 in a protected local file; no value is written in any repository.

No V1 migration for the original bridge: `ExperienceLaunchCode` already exists and `productCode` is a string. Free access only; no paid grant, subscription or new entitlement is provisioned. The 2026-11-15 account-step addition brings ONE migration (`provider_accounts`, see above) and no new variable.

## Hard boundary: no label data in V1

Label templates, barcodes and scan checks stay in SC4NNER's own database, keyed by `masterIdentityId`. V1 never receives or stores a label, a label template or a scan check. The exchange returns the account context and nothing else. The additions since 2026-11-14 stay inside that boundary: SC4NNER may read the V1 inventory catalog of the signed-in identity (next section), and V1 keeps the account's provider record (`ProviderAccount`, account context only — never label data).

## Inventory catalog link (2026-11-14, owner's order)

Behind the label studio, the owner wants the full TAKATAK inventory ecosystem: products tracked by UPC, stock kept like a shop catalog. That inventory already lives in V1 (`/dashboard/inventory`, PR #218). This link lets the deployed SC4NNER studio start a label from an inventory product, so the printed SKU/GTIN is the one the inventory and the registers recognise.

- `POST /api/experiences/sc4nner/inventory`: same bearer service token as the exchange. Body: `{masterIdentityId}`. Returns `{ok:true, linked, workspaces:[{clientId, clientName, brands, products}]}` with product `id, businessBrandId, name, sku, category, size, ingredients, gtin, priceCents, quantity, threshold` (label artwork is never read or returned).
- Resolution: master identity → its V1 profile → active workspace memberships. A workspace is served only when the membership's effective `view_inventory` permission — computed exactly like the dashboard API gate (role base or custom role / role override, plus grants, minus denials) — allows it, and the client is neither paused nor archived. Paused/archived clients and suspended memberships are excluded. Tenant scope always comes from the membership, never from a requested workspace id.
- An identity without a V1 profile gets `{linked:false, reason:"no_profile"}`: SC4NNER keeps working standalone for that account.
- Caps: 25 workspaces, 200 products per workspace; workspaces without products are omitted.
- Implementation: `src/lib/experiences/sc4nner-inventory-access.ts`, pure permission rule in `src/lib/experiences/sc4nner-inventory-permissions.ts`, contract tests in `scripts/sc4nner-inventory-bridge-tests.ts` (`npm run qa:sc4nner-inventory`). No migration, no new variable: the endpoint reuses `TAKATAK_SC4NNER_SERVICE_TOKEN`. SC4NNER derives its URL from the configured exchange URL (optional override `TAKATAK_SC4NNER_INVENTORY_URL` on the SC4NNER side only).
- Read-only: this endpoint never creates or edits a product and never moves stock. Stock changes stay in the V1 dashboard, behind `manage_inventory`.

State of this addition: written by Taktak @ Muse VM, 2026-11-14; contract tests, access matrix and inventory suites green locally; typecheck shows only the pre-existing food-hub error. Not merged, not deployed.

## State

Written by Taktak under the owner's full authorization of 2026-11-14 (owner order: finish SC4NNER end to end), locally checked (`tsc --noEmit` on the project, ESLint on the new and changed files). **Not merged, not deployed, never run against the SC4NNER deployment.** Full CI and build are for the PR. Production needs the three variables on both sides, redeploys, and a real sign-in smoke test with two accounts: sign up on takatak.ca, sign in to SC4NNER, save a label, sign back in (the label is still there), and a second account must not see it.

## Release guard

No direct V1 main change or production deploy by the agent. PR for owner/coordinator review under WORKLOG release rules.

— signed: Taktak @ Muse VM · 2026-11-14
