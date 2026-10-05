# TAKATAK current state

Audit of `takatakca/takatak-v1` at `main` (`df444b4`) before the Contabo/Coolify foundation. No secret values.

## 1. Package manager

npm. Production and CI install with `npm ci` against `package-lock.json`. `.npmrc` sets `ignore-scripts=true` so MochaHost npm installs do not fork Prisma; CI and the Coolify image pass `--ignore-scripts=false`.

`pnpm-lock.yaml` is present and unused by CI, `deploy/linux/Dockerfile`, and `docs/TAKATAK_MOCHAHOST_DEPLOYMENT.md`. Do not switch the app to pnpm in this migration.

## 2. Node

`engines.node` is `22.x`. `.nvmrc` is `22`. CI and `deploy/linux/Dockerfile` pin `22.23.2`.

## 3. Build

`npm run build` → `next build --webpack`.

Turbopack is not the production builder. It rewrites Prisma imports to hashed package names that do not exist.

## 4. Production start

MochaHost / cPanel / Passenger starts `node server.js`. That file loads `.env`, forces Postgres `sslmode=no-verify`, and hands the socket to Passenger when present. Otherwise it listens on `0.0.0.0:$PORT` (default 3000).

`npm start` is `next start`. That is the Coolify command. It does not apply the MochaHost TLS workaround.

## 5. Dockerfile

`deploy/linux/Dockerfile` exists. It is a Linux artifact builder. Its command lists `var/artifacts`. It is not a Coolify runtime image.

There was no root `Dockerfile` before this branch.

## 6. Next standalone output

Not enabled. `next.config.ts` has no `output: "standalone"`.

Standalone would break the current app:

- The MochaHost entry is custom `server.js`, not Next's standalone server.
- `scripts/pack-production-artifact.cjs` requires a full `.next`, full `node_modules`, and `server.js`.
- Prisma uses `engineType = "client"` plus `@prisma/adapter-pg`. Standalone file tracing drops that client.

Coolify uses the root `Dockerfile` and `next start` instead.

## 7. Existing CI

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main`, `master`, and two named branches. It installs with npm, generates Prisma, typechecks, lints, runs product QA, starts an ephemeral local Supabase, runs `prisma migrate deploy` there, builds with webpack, and packs a Linux tarball. It does not deploy.

`.github/workflows/reconcile-production-migrations.yml` can audit or apply production migrations only when `TAKATAK_PRODUCTION_DATABASE_URL` is set and, for a manual apply, the operator confirms the project ref. This migration does not run that workflow.

## 8. Existing production deploy

MochaHost Application Hosting. The repeatable path is `docs/TAKATAK_MOCHAHOST_DEPLOYMENT.md`: Linux artifact, Passenger startup file `server.js`, env outside the tarball. Vercel cron config exists only as `vercel.json` (`/api/cron/social-sync-jobs` every minute). Production is not Vercel.

## 9. Health endpoints

- `GET /api/health` — liveness. Production returns `{ status, app, alive }` unless `HEALTH_DETAILS_ENABLED=true`.
- `GET /api/health/ready` — database `SELECT 1` and Supabase configuration. States are `ok`, `unavailable`, or `not_configured`. No passwords, URLs, tokens, or stack traces.

Coolify should use `/api/health/ready`.

## 10. Environment names

The inventory of names actually read by the app is `ENVIRONMENT_VARIABLES.md`. `.env.example` lists names only.

## 11. Supabase

Auth and Postgres stay on Supabase. Client code reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server admin reads `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. Prisma uses pooled `DATABASE_URL` and direct `DIRECT_URL`. CI refuses a hosted Supabase URL in the ephemeral job (`scripts/ci-fail-if-hosted-supabase.cjs`). The production project ref appears in the migration workflow as a confirmation string, not as a credential.

## 12. Prisma

`prisma/schema.prisma`, provider `postgresql`, generator `prisma-client-js` with `engineType = "client"`. About 102 migration directories under `prisma/migrations`, locked to PostgreSQL. Generate with `npm run db:generate` (`prisma/generate.cjs`), which refuses to run on MochaHost. `npm run db:migrate` is `prisma migrate dev` and must not be used against production. `npm run db:deploy` is `prisma migrate deploy` and is used by CI against ephemeral Supabase only.

## 13. Cron routes

`src/app/api/cron/social-sync-jobs/route.ts` (`GET` and `POST`). Auth is `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`. Without `CRON_SECRET`, only non-production runtimes are allowed. `vercel.json` schedules it every minute. The route schedules due Facebook syncs and runs the existing Postgres job tick.

## 14. Background processing

No BullMQ or ioredis before this branch. Durable work is already in Postgres:

- `Job` rows for Facebook page sync and competitor snapshots, leased and retried by `runFacebookPageSyncWorkerTick` and `runFacebookCompetitorWorkerTick`.
- `npm run worker:social-sync` runs one tick (`scripts/run-social-sync-worker.ts`).
- Hockey SMS, calendar, and departure workers are in-process or HTTP-triggered (`/api/internal/hockey/delivery/run`), not a Redis queue.

## 15. Social sync

Facebook page and competitor sync is a Postgres outbox (`claimAndEnqueueFacebookPageSync`, `enqueueFacebookCompetitorRefresh`). OAuth callbacks for Meta, Instagram, Threads, TikTok, X, and Google are HTTP routes under `src/app/api/social/callback/`. Tokens are decrypted with `SOCIAL_TOKEN_ENCRYPTION_KEY_V1` at execution time.

## 16. Webhook routes

- `POST /api/billing/stripe/webhook`
- `POST /api/billing/hockey/webhook`
- `POST /api/integrations/upmind/webhook`

Stripe routes verify `stripe-signature`, then `applySocialStripeWebhookEvent` / `applyHockeyStripeWebhookEvent`, which record `stripeWebhookEvent` / `hockeyStripeWebhookEvent`. Upmind verifies its signature and records a receipt summary without the raw body.

## 17. Stripe routes

Webhook routes above, plus checkout, portal, and addon routes under `src/app/api/billing/stripe/` and hockey checkout/portal under `src/app/api/billing/hockey/`.

## 18. Twilio routes

No inbound Twilio webhook route. Twilio is outbound: phone OTP (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`) and hockey SMS (`TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_SMS_FROM`) behind `HOCKEY_SMS_ENABLED`.

## 19. Meta, Google, and social callbacks

- Meta / Facebook: `/api/social/callback/facebook` and `/handoff`
- Instagram: `/api/social/callback/instagram` and `/handoff`
- Threads: `/api/social/callback/threads` and `/handoff`
- TikTok: `/api/social/callback/tiktok` and `/handoff`
- X: `/api/social/callback/x` and `/handoff`
- Google social: `/api/social/callback/google` and `/handoff`
- Google Calendar (AHMV): `/api/hockey/calendar/google/callback`
- Supabase auth: `/auth/callback`

`META_OAUTH_REDIRECT_URI` is the production first hop. A Cloudflare relay lives in `deploy/oauth-callback-relay/` and is unchanged.

## 20. Queue library

None before this branch. The Postgres `Job` table is the social-sync source of truth and stays that way. Redis is an optional wake-up for workers that are not started while MochaHost still consumes the same jobs.
