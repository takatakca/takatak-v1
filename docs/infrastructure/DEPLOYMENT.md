# Deployment

Production today is MochaHost. This document is how to run the same application on Coolify later. It does not perform that deploy.

## Local

```bash
nvm use
npm ci --ignore-scripts=false
npm run db:generate
npm run dev
```

Copy `.env.example` to `.env.local`. Do not commit it.

Queue checks without Redis:

```bash
npm run qa:queue
```

Workers, only when `REDIS_URL` points at a private Redis:

```bash
npm run worker:general
npm run worker:social
npm run worker:webhooks
```

`npm run worker:social-sync` is the existing one-shot Postgres consumer. Keep using it on MochaHost.

## Coolify application

- Build pack: Dockerfile at the repository root.
- Node image: `22.23.2`.
- Install: `npm ci --ignore-scripts=false` (already in the Dockerfile).
- Build: `npm run db:generate` and `npm run build`.
- Start: image command, `next start -H 0.0.0.0 -p $PORT`.
- Health check: `GET /api/health/ready`, timeout at least 8 seconds.
- Port: Coolify's internal `PORT`. Do not publish 3000 on the host firewall.

Build arguments (public, required):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

Plus any optional `NEXT_PUBLIC_*` from `ENVIRONMENT_VARIABLES.md` that the bundle should contain.

Runtime environment: server secrets from that same document. Set `TAKATAK_READY_REQUIRE_DATABASE=true` on Coolify. Leave `TAKATAK_QUEUE_ENABLED` and `TAKATAK_QUEUE_WEBHOOKS` false until the matching worker is running.

## Worker services

Same image, custom start command, no HTTP port:

| Service | Command | Production |
| --- | --- | --- |
| general | `npm run worker:general` | configured, stopped |
| social | `npm run worker:social` | configured, stopped while MochaHost cron runs |
| webhooks | `npm run worker:webhooks` | configured, stopped |

The general worker logs `idle` and waits for `SIGTERM`. It has no jobs.

## Redis

Use `deploy/coolify/docker-compose.redis.yml` or a Coolify Redis resource with the same settings:

- image `redis:7.4-alpine`
- AOF on, `appendfsync everysec`
- `maxmemory-policy noeviction`
- `requirepass` from `REDIS_PASSWORD`
- no published port
- separate instance for staging and production

Application `REDIS_URL` uses `rediss://` or `redis://` on the Docker network, never `0.0.0.0`, never a `NEXT_PUBLIC_` name.

## GitHub Actions

`.github/workflows/ci.yml` installs, generates Prisma, typechecks, lints, runs `qa:queue`, runs the existing QA and ephemeral Supabase migrate, then builds. A failed build does not deploy.

The job `Gate Coolify deploy webhook` runs only after that job succeeds, only on a push to `main`. If `COOLIFY_DEPLOY_WEBHOOK_URL` or `COOLIFY_DEPLOY_WEBHOOK_TOKEN` is missing, it logs that it did not deploy and exits 0. It does not contain a webhook URL. Do not treat a green CI run as a production deployment.

## Staging order

1. Provision the VPS and Coolify. Not done in this change.
2. Create staging Redis with no public port.
3. Create the staging web service on `staging.takatak.ca` with build args and runtime env.
4. Confirm `GET /api/health/ready` is 200 and the body has no secrets.
5. Leave workers stopped. Keep MochaHost cron as the social consumer.
6. Exercise login, one Stripe test webhook (inline), and one social callback against staging URLs.
7. Only then set `TAKATAK_QUEUE_ENABLED=true` and start the social worker in staging.
8. Start the webhooks worker and set `TAKATAK_QUEUE_WEBHOOKS=true` only after it is healthy. Otherwise Stripe events would be acknowledged and left in Redis.

## What this does not do

- No DNS change for `takatak.ca`.
- No MochaHost env edit.
- No `prisma migrate deploy` against production.
- No cPanel, Plesk, or host Postgres.
- No SSH lockdown.
