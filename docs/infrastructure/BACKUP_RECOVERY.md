# Backup and recovery

| Data | Where it lives | Backup |
| --- | --- | --- |
| Application code | GitHub `takatakca/takatak-v1` | Git history. Coolify deploys a commit, not a unique copy of the source |
| Database | Supabase | Supabase backups / PITR. Contabo does not replace this |
| Auth users | Supabase Auth | Same Supabase project backup |
| Uploads | Supabase storage buckets used by the app | Supabase storage backup |
| Redis queues | Contabo disk, Coolify volume | AOF on the volume. Not a system of record. Social jobs are in Supabase |
| Coolify `APP_KEY` | Coolify | Copy it off the VPS to a password manager. Losing it can make Coolify unable to read its own secrets |
| Server | Contabo VPS | Contabo automatic backup of the VM, plus the off-box `APP_KEY` |
| Email | MochaHost | Unchanged. Do not restore mail by rebuilding it on Contabo |
| Secrets | Coolify env and MochaHost env | Password manager. Not git |

## Restore

1. Restore Supabase first if the database is the failed part. The app cannot reconstruct tenants from Redis.
2. Restore the VPS from Contabo backup if the host is lost, then confirm Coolify can decrypt with the off-box `APP_KEY`.
3. Redeploy the last known-good git commit. CI artifact tarballs remain the MochaHost rollback path.
4. If Redis AOF is corrupt, start with an empty Redis. Re-run is safe: social leases and Stripe event ids are idempotent. Do not invent a new encryption key to "fix" a restore.

## What not to back up into git

`.env`, Coolify `APP_KEY`, SSH private keys, Stripe secrets, service-role keys, `REDIS_URL`, and token encryption keys.
