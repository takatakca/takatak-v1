# TAKATAK V1 — Deployment and Recovery

Updated 2026-10-14. This document is an index of **existing supported** release mechanisms, not a new deployment mechanism. Detailed authoritative runbooks:

- [TAKATAK_PRODUCTION_PROMOTION.md](TAKATAK_PRODUCTION_PROMOTION.md)
- [TAKATAK_MOCHAHOST_DEPLOYMENT.md](TAKATAK_MOCHAHOST_DEPLOYMENT.md)
- [staging-migration-reconciliation.md](staging-migration-reconciliation.md)
- [TAKATAK_V1_PRODUCTION_CUTOVER.md](TAKATAK_V1_PRODUCTION_CUTOVER.md)
- [TAKATAK_V1_ROLLBACK_PLAN.md](TAKATAK_V1_ROLLBACK_PLAN.md)
- [WORKLOG.md](../WORKLOG.md) (release authority / post-its)

## Verified architecture and constraints

Current documented production target: `https://takatak.ca`, Node 22 on MochaHost/cPanel Passenger, app entry `server.js` and a Linux webpack build with generated Prisma client. Do **not** build on the constrained MochaHost host; CI builds the Linux artifact. Hosting migration to Contabo/Coolify is separate and was frozen in the work log; never assume it occurred.

`main` GitHub Actions pipelines include:

- `.github/workflows/ci.yml`: install `package-lock.json`, generate Prisma, QA/security checks, database-isolated tests, `next build --webpack`, immutable artifact tarball, checksums and startup smoke.
- `.github/workflows/reconcile-staging-migrations.yml`: staging migration audit/apply with explicit gate. Do not apply unapproved SQL.
- `.github/workflows/release-staging.yml`: staging release with migration readiness gates.
- `.github/workflows/validate-production-artifact.yml`: validation-only checks.
- `.github/workflows/release-production.yml`: manual artifact promotion, exact green `main` SHA + CI run ID, `validate` then `promote`.

## Operator prerequisites before any release

1. Read `AGENTS.md`, WORKLOG.md's **Release control**, release runbooks and latest merged `main` SHA. Current worklog reserves **all merges and deployments to a single coordinator** until the owner lifts this rule. This does not authorize this agent to dispatch workflows.
2. Staging database snapshot and approved migrations must be documented before any apply. Required migration history must be reconciled.
3. Production uses the GitHub `production` environment with seven `TAKATAK_PRODUCTION_*` values:
   - `TAKATAK_PRODUCTION_HOST`
   - `TAKATAK_PRODUCTION_SSH_PORT`
   - `TAKATAK_PRODUCTION_USER`
   - `TAKATAK_PRODUCTION_APP_ROOT`
   - `TAKATAK_PRODUCTION_SSH_PRIVATE_KEY`
   - `TAKATAK_PRODUCTION_KNOWN_HOSTS`
   - `TAKATAK_PRODUCTION_RESTART_COMMAND`
4. Release wrapper has an existing `current` symlink, releases directory, server-held `.env`, verified SSH host key and rollback target. The production flow does not create these or migrate an old direct app root.
5. Supabase Auth, database, SMS provider and server-only credentials are configured and tested separately. Never store secret values in GitHub source or in this document.

## Authorized promotion procedure (coordinator only)

1. Merge reviewed feature PRs **one at a time** after approval. Observe a **successful `main` CI** run and its immutable `takatak-ci-<sha>` artifact (the same `main` SHA currently at HEAD).
2. GitHub → Actions → **Promote verified TAKATAK production artifact**, on `main`; supply exact `release_sha`, successful `ci_run_id`, `confirm_production_origin=https://takatak.ca` and `mode=validate`.
3. Check validation evidence, SHA, archive hashes and app metadata. Nothing is installed by `validate`.
4. After confirming operator prerequisites and owner/coordinator approval, re-run the exact values with `mode=promote`. Workflow refuses `main` drift; upload/activation uses a saved previous release for rollback.
5. Confirm `GET https://takatak.ca/api/health` returns a **matching `X-TAKATAK-Release` SHA**, and `GET /api/health/ready` explicitly reports database/Supabase `ok`; check user/API smoke gates and application logs. Record the exact live version and time in [AGENT_HANDOFF.md](AGENT_HANDOFF.md).
6. When readiness fails, follow the documented rollback path, verify previous runtime and inspect logs. Do not claim success from CI or from switching a symlink.

## Safe developer validation (without deployment)

```bash
npm ci --ignore-scripts=false
npm run db:generate
npm run typecheck
npm run lint
npm run qa:ads
npm run qa:access
npm run qa:production-release
npm run build
```

Run on a suitable Linux/Node 22 workstation or GitHub CI. These commands are **examples** of required verification and are not asserted to have run in the documentation-only session. No local build access or external production environment credentials are assumed.

## Last observed delivery

On 2026-10-14, PR #176 and PR #177 each had **successful branch CI**, but both were open. Their changes are not on `main` and there is **no proof of live deployment**. See [PROJECT_STATUS.md](PROJECT_STATUS.md) and [AGENT_HANDOFF.md](AGENT_HANDOFF.md) for precise state.

Do not replace the existing controlled workflow with a broad `push main → deploy` shortcut: it would bypass database approval, user-facing auth checks and rollback protections.
