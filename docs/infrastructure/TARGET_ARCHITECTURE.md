# Target architecture

Contabo VPS + Coolify runs TAKATAK web/API, optional workers, and private Redis. Nothing else moves in this change.

```text
Internet
  |  22, 80, 443
  v
takatak-core-01  (Contabo)
  Coolify
    takatak-web          next start, 0.0.0.0:$PORT, not published as 3000
    takatak-worker-*     configured, not started while MochaHost workers run
    redis                private, AOF, noeviction, auth, no host port
         |
         | TLS
         v
Supabase Postgres + Auth          stays
Stripe, Twilio, Meta, Google,
YouTube                           stay external
MochaHost                         email, Ultimate, Reseller 15 stay
```

Out of scope: 42 client sites, QMAPS, FLEXS, other products, DNS, MX, SPF, DKIM, DMARC, and replacing Supabase with host Postgres.

## What Coolify runs

| Service | Start | When |
| --- | --- | --- |
| Web | image `CMD` (`next start -H 0.0.0.0 -p $PORT`) | staging first |
| General worker | `npm run worker:general` | idle; no queue callers yet |
| Social worker | `npm run worker:social` | after staging Redis exists; not while MochaHost cron still owns sync |
| Webhooks worker | `npm run worker:webhooks` | only if `TAKATAK_QUEUE_WEBHOOKS=true` |
| Redis | `deploy/coolify/docker-compose.redis.yml` | one instance per environment |

The web image is also the worker image. Override the start command. Do not use `deploy/linux/Dockerfile` for Coolify. That file builds the MochaHost tarball.

## Why not standalone

See `CURRENT_STATE.md`. The root `Dockerfile` copies the webpack build and full `node_modules`, then runs `next start`.

## Why not a second social system

Facebook sync jobs are already durable Postgres rows with leases, attempts, and backoff. Redis only signals `social-sync` and `analytics-sync` after that row exists. If Redis is down or `TAKATAK_QUEUE_ENABLED` is not `true`, the HTTP request still succeeds and the existing cron / `worker:social-sync` path still drains the table.

Webhook queueing is a separate switch, `TAKATAK_QUEUE_WEBHOOKS`. Default is inline apply, which is what MochaHost does today.

## Hostnames

| Name | Role |
| --- | --- |
| `takatak-core-01` | Contabo VPS hostname |
| `coolify.takatak.ca` | Coolify UI |
| `staging.takatak.ca` | staging web |
| `api-staging.takatak.ca` | staging API, same app |
| `prod-check.takatak.ca` | production candidate before cutover |
| `dashboard.takatak.ca` | future production dashboard |
| `api.takatak.ca` | future production API |

DNS for these names is not changed in this repository work.

## Resource budget

One Contabo VPS for the TAKATAK control plane only.

| Piece | Budget |
| --- | --- |
| Web | 1 Coolify app, 1–2 replicas later, not on day one |
| Workers | 3 processes, 1 concurrency for social, 2 for webhooks, stopped in production until cutover |
| Redis | 256–512 MB, `noeviction`, AOF every second |
| Postgres | none on the VPS |
| Disk | image layers + Redis AOF + Coolify. Code is on GitHub |

Do not colocate client sites, QMAPS, or FLEXS on this application.

## Firewall

Public: 22, 80, 443.

Coolify UI and realtime (8000, 6001, 6002) and the proxy dashboard port 8080 are localhost-only once `coolify.takatak.ca` is on HTTPS.

Never public: 3000, 3001, 5432, 6379, 3306, 27017.

This repository does not change the live firewall. SSH hardening is out of scope until an operator has a tested second login.

## Email

Stays on MochaHost. The app still sends OTP and moderator mail through the existing SMTP/SendGrid/Twilio settings. Do not move MX.

## Build versus runtime

`NEXT_PUBLIC_*` values are compiled into the browser bundle. Coolify must pass them as Docker build arguments. Changing them later requires a rebuild. Server secrets (`DATABASE_URL`, `REDIS_URL`, Stripe, Twilio, Meta, encryption keys) are runtime environment only and must not be build arguments.

## Production workers

Documented and present in the image. Not started while MochaHost `worker:social-sync` or the social cron is still running. Starting both would make two consumers lease the same Postgres jobs. Leases make that safe but noisy. Leave the Coolify worker services stopped until cutover.
