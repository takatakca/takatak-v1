# TAKATAK Food Hub (inside the TAKATAK Dashboard)

Food Hub is TAKATAK's own delivery-platform hub. It replaces UrbanPiper / Atlas. It connects
**Uber Eats, DoorDash, SkipTheDishes and Too Good To Go** directly, sends their orders to
**Clover**, and shows everything on one screen: orders, menus, store status and payouts.

It lives at **`/dashboard/food-hub`**, under *Services → Food Hub* in the sidebar.

## Who can use it

- **Sign-in, sign-up, invitations and users are TAKATAK's.** Food Hub has no logins of its own.
- **Food Hub runs for one workspace: the one that owns the restaurants.** The first time, the owner
  of that workspace opens Food Hub and clicks **Activate Food Hub for "<workspace>"**.
  - That person must be a TAKATAK platform owner/admin, or be listed in `FOOD_HUB_OWNER_EMAILS`.
  - `FOOD_HUB_CLIENT_ID=<workspace uuid>` forces the workspace from the server instead.
- **The workspace role decides what each person can do** (TAKATAK → Team & Permissions):

| TAKATAK role | Food Hub access |
|---|---|
| owner, admin | Everything: setup, users, secrets, payouts |
| manager | Operations, menus, stores, analytics, payouts |
| editor | Menu editor: menus, prices, hours, 86 |
| staff | Store operator: orders, 86, pause |
| viewer | Analyst: analytics and reports (read-only) |

**Access checks**
- Every Food Hub API re-checks the TAKATAK session. The rules are in `src/lib/food-hub/access.ts` and `auth.ts`.
- Platform webhooks (`/api/food-hub/webhooks/*`) are public. Each one verifies its own signature or token.
- Cron routes need `Authorization: Bearer $CRON_SECRET`.

## Database

**Where the data is**
- Food Hub data lives in the **`foodhub` schema** of the shared TAKATAK Supabase project. This follows the Rentauto pattern.
- Tables: `fh_orders`, `fh_order_events`, `fh_channel_stores`, `fh_menus`, `fh_jobs`, `fh_kv`, `fh_activity`, `fh_docs`.
- The migration is `prisma/migrations/20261002180000_food_hub_schema`. Apply it with `npm run db:deploy`.

**Security**
- Server-only: only `service_role` has grants.
- RLS is enabled with no policies.
- `anon` and `authenticated` cannot read anything.
- The migration exposes `foodhub` to PostgREST next to `rentauto` (`pgrst.db_schemas`).

**Keys**
- No new database key is needed. Food Hub uses the same `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` as the dashboard.

## Platform credentials (server `.env` only — never in chat, never in git)

```bash
npm run food-hub:setup                 # local .env.local
npm run food-hub:setup -- --file .env  # on the server, next to the release
```

The wizard updates only the Food Hub lines. It also generates the webhook secrets and `CRON_SECRET`.

| Platform | Variables |
|---|---|
| Clover | `CLOVER_BASE_URL`, `CLOVER_MERCHANT_ID`, `CLOVER_ACCESS_TOKEN`, optional `CLOVER_MERCHANT_TOKENS`, `CLOVER_PRINT_DEVICE_ID`, `CLOVER_WEBHOOK_AUTH` |
| Uber Eats | `UBER_CLIENT_ID`, `UBER_CLIENT_SECRET` (after Uber approves the eats.order / eats.store scopes) |
| DoorDash | `DOORDASH_DEVELOPER_ID`, `DOORDASH_KEY_ID`, `DOORDASH_SIGNING_SECRET`, `DOORDASH_PROVIDER_TYPE` |
| SkipTheDishes | `SKIP_JET_API_KEY`, `SKIP_JET_BASE_URL` (JET Connect partner access) |
| Reports by email | `RESEND_API_KEY`, `REPORT_EMAIL_FROM` |
| Live switch | `LIVE_CONNECTORS_GLOBAL_ENABLED=true` — last step, after the Go-Live checklist is green |

**Public URL in webhook addresses**
- Webhook URLs use `NEXT_PUBLIC_APP_URL`, or `FOODHUB_PUBLIC_URL` when it is set.
- The exact URLs and secrets to give each platform are on **Food Hub → Channels**.

## Scheduled jobs

Call these with `Authorization: Bearer $CRON_SECRET`:

| Route | When | What it does |
|---|---|---|
| `GET /api/food-hub/cron/sync` | every 5 min | Store status, scheduled orders, auto-complete, Clover 86 |
| `GET /api/food-hub/cron/reports` | daily | Scheduled report emails |
| `GET /api/food-hub/cron/reopen` | optional | Re-opens timed pauses only (the sync already does it) |

`vercel.json` schedules them. On MochaHost, use cPanel cron jobs.

## Tests

- `npm run qa:food-hub`: 58 unit tests (statements, payouts, ledger, menus, webhooks, roles). Runs in CI.
- The full platform simulation (263 end-to-end checks against simulated Uber, DoorDash, Skip and Clover) was run before this module was merged.
