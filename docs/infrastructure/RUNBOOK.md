# Runbook

Operators only. No secret values belong in tickets or shell transcripts. If a command would print `DATABASE_URL` or `REDIS_URL`, do not run it.

## Health

```bash
curl -fsS "https://staging.takatak.ca/api/health"
curl -fsS "https://staging.takatak.ca/api/health/ready"
```

Ready body shape:

```json
{ "ok": true, "checks": { "process": "ok", "database": "ok", "supabase": "ok", "redis": "not_configured" } }
```

`redis` is `not_configured` until `REDIS_URL` is set, `ok` after a ping, `unavailable` if the ping fails. Failure text is not included. `ok: false` is HTTP 503.

`/api/health` is liveness and stays minimal in production.

## Processes

| Symptom | Look at |
| --- | --- |
| Web 503 on ready, database `unavailable` | Supabase pooler, `DATABASE_URL` host, TLS. Do not set `sslmode=no-verify` on Coolify to hide it |
| Web 503, redis `unavailable` | Redis container, password, network. Unset `REDIS_URL` only if this environment is supposed to run without Redis |
| Social data stale | Postgres `Job` rows first. MochaHost cron if workers are still stopped. Redis lag only if `TAKATAK_QUEUE_ENABLED=true` |
| Stripe retries | Web logs for `Invalid Stripe signature` (400) or apply failure (500). If `queued: true` was returned, the webhooks worker must be up |
| OAuth redirect mismatch | `META_OAUTH_REDIRECT_URI` and provider-specific redirect vars. Do not trust the request Host header |

## Workers

Logs are JSON. They include `worker`, `outcome`, and `error` as an error name, not a message and not a URL.

Stop order: webhooks worker, social worker, then set the matching `TAKATAK_QUEUE_*` flag false, then restart web. Start order is the reverse, flags true only after the worker is up.

`SIGTERM` and `SIGINT` close BullMQ workers and exit. Coolify should send `SIGTERM` and wait at least 15 seconds.

## Queue behavior

- Social and analytics jobs carry `workspaceId`, `connectionId`, `provider`, and `eventId` only.
- The social worker passes `workspaceId` into the existing tick as `clientId`.
- The analytics worker loads the Postgres job and refuses it when `clientId` does not match `workspaceId`.
- Attempts: 3, exponential backoff from 2 seconds.
- HTTP 401 / 403 / 404 from Stripe and permanent unauthorized errors become BullMQ unrecoverable. They are not retried until the attempts counter is exhausted.
- Upmind stays inline. Its handler does not store the raw body, so a Redis job cannot rebuild the event.
- Stripe and hockey Stripe write `provider_webhook_receipts` (event id and status only) before Redis accepts the job. Apply still records `stripe_webhook_events` or `hockey_stripe_webhook_events`. A Redis loss does not delete the payment intent. The webhooks worker re-queues a `queued` receipt that is older than 45 seconds.

The Contabo host bootstrap is `CONTABO_BOOTSTRAP.md`. Do not run it until the operator can reach the VPS.

## Migrations

Review `prisma/migrations` before any `prisma migrate deploy`. CI already deploys them to ephemeral Supabase. Do not run `prisma migrate dev` against production. Do not run the reconcile workflow unless you intend to touch production and can confirm the project ref.

## Firewall reminder

Public 22, 80, 443. Coolify 8000, 6001, 6002, and 8080 are localhost-only on `takatak-core-01`. Never 3000, 3001, 5432, 6379, 3306, 27017.

## Escalation

Hosting provider logins (Contabo, Coolify, Cloudflare, GitHub App, Supabase, Stripe, Meta, Google, Twilio) are human steps. Do not paste secrets into chat. Say which system you signed into.
