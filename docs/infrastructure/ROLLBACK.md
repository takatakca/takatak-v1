# Rollback

Use this if Coolify misbehaves after a cutover. Until cutover, MochaHost is still production and no rollback is required.

## Application

1. Point `takatak.ca` back at MochaHost. The previous Passenger release should still be on disk (`previous` in `docs/TAKATAK_MOCHAHOST_DEPLOYMENT.md`).
2. Stop Coolify web so it cannot keep taking traffic or Stripe retries.
3. Stop Coolify workers so they cannot lease Postgres jobs.
4. Start the MochaHost social cron / `worker:social-sync` again.
5. Set Coolify `TAKATAK_QUEUE_ENABLED` and `TAKATAK_QUEUE_WEBHOOKS` back to false before the next boot, so a stray process does not ack webhooks into an unwatched Redis.

Database schema is shared (Supabase). Rolling back the app does not roll back a migration. Do not run a down migration against production as part of a hosting rollback.

## Redis

Redis holds wake-up jobs, not the social source of truth. Dropping a staging Redis volume loses unprocessed BullMQ jobs. Postgres `Job` rows and Stripe's own retries remain. Do not point production at a flushed staging instance.

## Secrets

Rollback does not rotate encryption keys. The MochaHost `.env` still has the keys that decrypt existing rows.

## Deploy webhook

If a Coolify deploy from GitHub was unwanted, disable the webhook in Coolify and remove `COOLIFY_DEPLOY_WEBHOOK_URL` from the GitHub environment. CI stays green without deploying. A failed CI run does not call the webhook.
