# Production cutover

Not started. Do this only after staging on `staging.takatak.ca` has passed and MochaHost is still serving `takatak.ca`.

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
