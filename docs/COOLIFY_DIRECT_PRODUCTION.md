# TAKATAK V1 — direct Coolify production deployment

**Target:** `https://takatak.ca` only. **No staging deployment.** This runbook
adds a Docker runtime and does **not** authorize schema changes or activate
integrations. It preserves the independent AHMV experience and TAKATAK's
tenant-scoped identity model.

## Release authority

`WORKLOG.md` records an active release lock: only the designated release
coordinator merges into `main` or deploys production. Obtain an explicit
coordinator release handoff before merging this PR and before changing live
DNS/traffic. The work here is safely reviewable without touching production.

## Coolify configuration

* **Dashboard:** `https://coolify.takatak.ca`
* **Server:** Contabo/Coolify `31.220.96.134`; existing Traefik proxy
* **Application source:** GitHub `takatakca/takatak-v1`, branch `main`
* **Build pack:** Dockerfile; **Dockerfile location:** `/Dockerfile`;
  **build context:** repository root `/`
* **Network:** internal container port `3000`; **public domain:**
  `https://takatak.ca`; HTTPS via existing Coolify Traefik
* **Process:** one web container only; no cron or Redis workers
* **Health:** Docker HEALTHCHECK `scripts/container-healthcheck.cjs`
  checks `/api/health/ready` AND asserts database and Supabase are `ok`.
  A superficial HTTP 200 is insufficient.

### Environment variables (values only in Coolify)

| Name | Build time | Runtime | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL=https://takatak.ca` | yes | yes | Correct public origin |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Public browser auth key |
| Other `NEXT_PUBLIC_*` used for enabled widgets | yes | yes | Public browser config |
| `DATABASE_URL` | **no** | yes | PostgreSQL pool connection |
| `DIRECT_URL` | **no** | yes | PostgreSQL direct migrations (if approved) |
| `SUPABASE_SECRET_KEY` (or legacy service-role key) | **no** | yes | Server-only auth |
| `EMAIL_USER` + `EMAIL_PASSWORD`, or `SENDGRID_API_KEY` | **no** | yes | OTP delivery |
| `NODE_ENV=production`, `PORT=3000` | no | yes | Process settings |
| `TRUSTED_PROXY_HOPS=1` | no | yes | One trusted Traefik hop |
| `TAKATAK_QUEUE_ENABLED=false` | no | yes | No queue activation |

The `NEXT_PUBLIC_*` values are the **only** values passed as Docker build
arguments. Never set **Build time** for `DATABASE_URL`, authentication secrets,
Stripe, Twilio or OAuth client secrets. Enable Coolify **Runtime** for private
values. Do not duplicate keys in Coolify's environment list. Enabling the
optional public integrations requires the additional corresponding public
build-time values (see `.env.example`). Keep unused providers disabled.

## Direct-production procedure (no staging)

1. Verify the exact `main` SHA and completed green CI run, review release
   lock and all migrations since the currently running production release.
2. Verify production database backups and recovery; run only approved,
   preflighted migrations under the established release coordinator. **No
   automatic `prisma migrate deploy` in Dockerfile/startup**.
3. Create the Coolify app with the settings above, configure variables
   privately, and build. Do not enable automatic production deployment
   before CI gating; do not activate workers, Stripe, Twilio or OAuth without
   their own review.
4. Verify container readiness AND full authenticated production E2E:
   sign-in, profile sync, owner bootstrap (authorized account only), membership
   enforcement, and a two-tenant isolation check. A passing /api/health by
   itself cannot prove these.
5. Before altering public DNS, test Coolify against its own public IP using
   `curl --resolve takatak.ca:443:31.220.96.134 https://takatak.ca/api/health/ready`,
   without `-k`. The certificate must be trusted. Coordinate any production
   domain cutover so existing services, sessions and mail records are retained.
6. Switch **only** the intended web A record after a successful go/no-go;
   verify `https://takatak.ca`, `/api/health`, `/api/health/ready`,
   login and cross-tenant isolation. Keep a rollback to the previous IP and
   immutable release. Do not automatically change `dashboard`, `api`,
   MX or other DNS.
7. Configure GitHub → Coolify redeploy only after a green `main` CI gate
   is enforced and the first production deployment has passed.

**No public keys, tokens, database credentials, SSH keys, or secrets are
committed to this repository.** The release is not live merely because the
Dockerfile or this runbook lands in `main`.
