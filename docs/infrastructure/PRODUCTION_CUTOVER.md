# Production cutover

The production web container is up. Customer DNS is not. MochaHost still serves `takatak.ca`.

Recorded DNS before any change, and unchanged after the web deploy:

| Name | Record |
| --- | --- |
| `takatak.ca` | A `209.42.24.127` |
| `dashboard.takatak.ca` | no A record |
| `api.takatak.ca` | no A record |
| `takatak.ca` | MX `0 mail.takatak.ca` |
| `mail.takatak.ca` | A `209.42.24.127` |
| `takatak.ca` | SPF TXT present |
| `default._domainkey.takatak.ca` | DKIM TXT present |
| `_dmarc.takatak.ca` | no TXT record |

Nameservers are `ns1.mysecurecloudhost.com`, `ns2.mysecurecloudhost.com`, `ns3.mysecurecloudhost.com`, and `ns4.mysecurecloudhost.com`. This session cannot edit that zone.

## Done on the server

- Existing production web app only. Coolify was not installed again.
- Branch `infra/contabo-coolify`, commit `e55af85`.
- `https://prod-check.31.220.96.134.sslip.io/api/health/ready` returns 200. Checks: database, Supabase, Redis, and process are ok. No secret fields in the body.
- The same URL `/login` returns the email OTP default.
- `takatak-redis-production` is private, AOF, `noeviction`, authenticated, and not published on 6379.
- Queue flags are false. Staging and production workers are stopped.
- Traefik routes `dashboard.takatak.ca` and `api.takatak.ca` to the production web container. Those routes have gzip only. There is no cache middleware on `/api`, `/auth`, `/oauth`, `/webhooks`, or `/billing`.
- Pending Prisma migrations were not applied.

## Still required

Create these records only. Do not change the apex A record, MX, SPF, DKIM, or DMARC.

| Name | Type | Value |
| --- | --- | --- |
| `dashboard.takatak.ca` | A | `31.220.96.134` |
| `api.takatak.ca` | A | `31.220.96.134` |

After those records resolve, the origin can issue Let's Encrypt certificates for them. Use Cloudflare Full (strict) only after those origin certificates are valid. Do not use Flexible.

Do not start workers until MochaHost cron, social sync, and queue processors are confirmed stopped.

## Before

- [ ] Staging web is healthy on `/api/health/ready`.
- [ ] Staging uses the production Supabase project only if that was an explicit decision. Prefer a staging Supabase project until the data cut is agreed. This repo does not create one.
- [ ] `SOCIAL_TOKEN_ENCRYPTION_KEY_*` and hockey encryption keys were copied, not regenerated.
- [ ] Redis is private. Staging and production Redis are different.
- [ ] Coolify worker services exist and are stopped.
- [ ] MochaHost cron / `worker:social-sync` is still the social consumer.
- [ ] Email MX stays on MochaHost.
- [ ] A fresh MochaHost artifact of the current release is still on disk for rollback.
- [ ] `prisma migrate deploy` was reviewed. Pending migrations were applied to a backup or staging database first, never as a surprise against production.
- [ ] Stripe, Meta, Google, and Twilio callbacks still target the live host until the DNS step.

## Candidate

1. Deploy the same image to `prod-check.takatak.ca` with production runtime env and `TAKATAK_QUEUE_*=false`.
2. Check health, login, and one read-only dashboard page.
3. Do not point `takatak.ca` at the VPS yet.

## Cutover window

1. Lower DNS TTL ahead of time (operator, not this repo).
2. Pause MochaHost social cron so jobs stop being leased.
3. Start Coolify social worker only after `TAKATAK_QUEUE_ENABLED=true` on the new web process.
4. Move `takatak.ca`, `dashboard.takatak.ca`, and `api.takatak.ca` to the Coolify proxy.
5. Update OAuth redirect URIs and Stripe webhook endpoints to the new origin if the host changed. Keep signature verification. Do not disable it.
6. Watch `/api/health/ready`, Stripe webhook responses, and social job completion.
7. Leave MochaHost web stopped but not deleted for the rollback window.
8. Leave email on MochaHost.

## Not in this cutover

Client sites, QMAPS, FLEXS, Ultimate, Reseller 15, and DNS records other than the TAKATAK app hostnames above.
