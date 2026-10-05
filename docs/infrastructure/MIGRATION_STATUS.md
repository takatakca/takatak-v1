# Migration status

`[ ]` not started, `[~]` in progress, `[x]` done in the repo, `[!]` blocked on a human login or an external system.

Repository foundation only. Contabo, Coolify, DNS, and production are not done.

- [x] Phase 1 audit recorded in `CURRENT_STATE.md`
- [x] Phase 2 quality gates that do not need live secrets (local Node 22.14.0; CI pins 22.23.2)
- [x] Phase 3 repo foundation: Dockerfile, queue, workers, docs, CI gate
- [x] npm remains the package manager (pnpm lockfile is not the deploy path)
- [x] Standalone output left off, with the reason recorded
- [x] `/api/health/ready` kept free of secrets and extended with a Redis state
- [x] BullMQ queues limited to callers: `social-sync`, `analytics-sync`, `webhooks`
- [x] Email, notifications, site-sync, imports, and reports queues skipped
- [x] Existing Postgres social jobs and Stripe/Twilio/Meta/Google routes kept
- [x] Webhook deferral defaults off
- [x] CI deploy webhook reads GitHub secrets and does not run after a failed build
- [ ] Contabo VPS `takatak-core-01` provisioned
- [ ] Coolify installed
- [ ] Private staging Redis
- [ ] Private production Redis
- [ ] Staging web service
- [ ] Production candidate `prod-check.takatak.ca`
- [ ] DNS cutover
- [ ] Production workers started
- [!] Push of `infra/contabo-coolify` and the draft pull request. GitHub is signed in as `takatakca`, and creating the branch ref returned 403 (token cannot write refs). Local commits exist. No production deploy was attempted.
- [!] Provider consoles (Contabo, Coolify, Cloudflare, GitHub webhook secret, Supabase, Stripe, Meta, Google, Twilio) need a human session before any live step

## Quality gates

Local run on `infra/contabo-coolify`, Node v22.14.0 (CI image remains 22.23.2).

- [x] `npm ci --ignore-scripts=false`
- [x] `npm run db:generate`
- [x] `npm run typecheck`
- [x] `npm run lint` (0 errors; existing warning in `src/components/rentauto/rentauto-host-verifications-card.tsx`)
- [x] `npm run test:auth`
- [x] `npm run test:identity`
- [x] `npm run qa:queue`
- [x] `npm run qa:secrets` (tracked files)
- [x] `npm run build` (`next build --webpack`). Existing warning: rentauto events route re-exports `dynamic` / `runtime`.
- [ ] Ephemeral Supabase CI (`supabase start`, RLS, tenant isolation). Not run locally. GitHub Actions runs it. No production migrate.
