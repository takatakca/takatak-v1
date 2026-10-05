# Migration status

`[ ]` not started, `[~]` in progress, `[x]` done in the repo, `[!]` blocked on a human login or an external system.

Repository foundation only. Contabo, Coolify, DNS, and production are not done. GitHub push is a separate, temporary block. It does not block the rest of the migration.

## Repository verification

Recorded on `infra/contabo-coolify` before the follow-up commits on this branch.

- `git status`: clean working tree on `infra/contabo-coolify`
- `git branch --show-current`: `infra/contabo-coolify`
- `git log -5 --oneline --decorate`: `d984810` (HEAD), `5ad9e41`, `c2ce6e6`, `01bd98c`, `f2a1030`
- `git show --stat d984810`: `docs/infrastructure/MIGRATION_STATUS.md`, 1 file, +1
- `git diff d984810^ d984810 --check`: clean, exit 0

`d984810` stays in the history. Later commits sit on top of it. No reset, no force-push.

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
- [x] `qa:workflow` checks that Coolify runs only after install, Prisma generate, typecheck, lint, QA, and the production build
- [x] Stripe webhook event ids are stored in Postgres before Redis is asked to carry them
- [x] Contabo bootstrap runbook written. Host facts are in `CONTABO_HOST_FACTS.md`. SSH hardening has not been run.
- [~] Contabo VPS `31.220.96.134` is reachable as `root` by key. Static hostname is already `takatak-core-01` (Ubuntu 24.04.5, 6 vCPU, 11 GiB RAM, 4 GiB swap). No hostname change was required. Firewall, Fail2ban, Docker, and Coolify were not changed.
- [ ] Coolify installed
- [ ] Private staging Redis
- [ ] Private production Redis
- [ ] Staging web service
- [ ] Production candidate `prod-check.takatak.ca`
- [ ] DNS cutover
- [ ] Production workers started
- [~] GitHub push of `infra/contabo-coolify` is temporarily blocked. The shell has no git credentials (`gh auth status` is not logged in; `GH_TOKEN` and `GITHUB_TOKEN` are unset). A later GitHub API call returned HTTP 429, a secondary rate limit, not a missing repository permission. Local commits remain. No production deploy was attempted. This line is not a migration-wide block.
- [!] Provider consoles (Contabo, Coolify, Cloudflare, Supabase, Stripe, Meta, Google, Twilio) need a human session before any live step. That does not stop repository work.

## Quality gates

Local run on `infra/contabo-coolify` after the receipt and health-check commits, Node v22.14.0 (CI image remains 22.23.2).

- [x] PASS `npm ci --ignore-scripts=false`
- [x] PASS `npm run db:generate`
- [x] PASS `npm run typecheck`
- [x] PASS `npm run lint` (0 errors; existing warning in `src/components/rentauto/rentauto-host-verifications-card.tsx`)
- [x] PASS `npm run test:auth`
- [x] PASS `npm run test:identity`
- [x] PASS `npm run qa:queue`
- [x] PASS `npm run qa:workflow`
- [x] PASS `npm run qa:rls:static`
- [x] PASS `npm run qa:secrets` (tracked files; CI scans the committed tree)
- [x] PASS `npm run build` (`next build --webpack`). Existing warning: rentauto events route re-exports `dynamic` / `runtime`.
- [ ] Ephemeral Supabase CI (`supabase start`, RLS, tenant isolation). Not run locally. GitHub Actions runs it. No production migrate.
