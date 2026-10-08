# Staging migration reconciliation

Staging project: `utuvzrqvivqyziibobvu`. Production project `pcjfahhlozsseqqevimi` is out of scope.

This document records the audit fix and the schema review. It does not authorize applying SQL or changing staging rows.

## Defects

`scripts/reconcile-staging-migrations.mjs` compared Supabase history with two escaped strings:

- `replace(/^\\d+_/, "")` looks for a backslash and the letter d. A real name such as `20261003063500_hockey_parent_team_preferences` never matched, so the lookup used the full directory name.
- `statements.join("\\n")` inserted the two characters `\` and `n` between statements. Repository SQL separates statements with a newline, so equal SQL compared as different.

Both now go through `scripts/staging-migration-history.mjs`. `migrationHistorySlug` uses `/^\d_+/`. `supabaseHistorySql` joins with a real newline. `scripts/staging-migration-history.test.mjs` locks both behaviors, including the proof that the old patterns do not match.

The earlier audit that reported zero externally applied migrations used the broken patterns. That count is not evidence.

## Apply gate

`.github/workflows/reconcile-staging-migrations.yml` selects `apply` only when all of these are true:

- the run is `workflow_dispatch`
- `mode` is `apply`
- `approval` is exactly `approve-staging-migrations`
- the ref is `refs/heads/main`

A successful CI `workflow_run` sets `RECONCILE_MODE=audit`. The step `Human approval accepted for staging apply` runs only for a dispatch apply, and it fails unless the phrase and main both match. A skipped approval step is not success.

`.github/workflows/release-staging.yml` asks `scripts/staging-release-approval.mjs` for evidence before either a manual or an automatic release can build. The evidence is a successful run of this reconcile workflow whose event is `workflow_dispatch`, whose head is the same main SHA being released, and whose approval step conclusion is `success`. An audit leaves that step skipped, so the release decision is `skip`: `ready=false`, no build, and no deploy. A manual release must pass `migration_run_id` for that approved run. Any other result is `refuse` and the release job fails. There is no longer a path that checks this evidence only for `workflow_run`.

Merging this pull request installs that gate. It does not apply SQL or change migration history. Do not dispatch apply until a separate approval, and do not treat this document as that approval.

## What apply would do later

Apply does not execute migration SQL. For each approved migration whose Supabase `statements` match the repository file, it records Prisma history with `prisma migrate resolve --applied`. If any approved migration is still pending after that, it exits and refuses `prisma migrate deploy`. Unrelated repository migrations stay outside the allowlist.

## Static review of the 19 approved files

Reviewed from `prisma/migrations/*/migration.sql` on main `9a0a74da09822ab481bffdf53912ef34b9dd936a`. No staging rows were read or written for this review. The live Prisma-versus-Supabase classification is in Live history below.

None of the 19 files contain `DROP TABLE`, `DROP COLUMN`, `DELETE FROM`, or `TRUNCATE`. The `UPDATE` matches in the files are `ON UPDATE CASCADE` foreign keys and `BEFORE UPDATE` triggers on the new tables. They do not update customer or reservation rows.

`20261003152000_ahmv_product_catalog` inserts the AHMV catalog, plans, prices, and entitlements into the tables that same file creates. `20261005043500_ahmv_smart_departure_entitlement` inserts the `smart_departure` entitlement for `parent_premium` only when that catalog row exists, and it does not attach it to `parent_essential`.

New tables reference existing `clients`, `profiles`, `master_identities`, `leads`, or `business_brands` only through foreign keys on the new tables. Creating those keys does not rewrite the referenced rows. `lead_attachments` uses `ON DELETE CASCADE` from `leads` and `clients`, so a later lead or client delete would remove its attachments. `client_stripe_connect_accounts` uses `ON DELETE RESTRICT` from `clients`.

| Migration | Schema change | Existing customer or reservation rows |
| --- | --- | --- |
| `20261003062000_hockey_membership_foundation` | Creates `hockey_memberships` and `hockey_stripe_webhook_events`, indexes, RLS | Untouched |
| `20261003063500_hockey_parent_team_preferences` | Creates `hockey_parent_team_preferences` | Untouched |
| `20261003064000_hockey_membership_rls_lockdown` | Enables RLS and revokes Data API grants on the three hockey tables above | No row changes. API access to those tables is removed |
| `20261003065000_hockey_supporter_thankyou_grants` | Creates `hockey_premium_grants` | Untouched |
| `20261003071000_hockey_parent_event_engine` | Creates `hockey_team_events` and `hockey_delivery_jobs` | Untouched |
| `20261003073000_hockey_google_calendar` | Creates calendar connection, OAuth state, and event mapping tables | Untouched |
| `20261003080000_hockey_smart_departure` | Creates `hockey_travel_profiles` | Untouched |
| `20261003081500_hockey_family_team_isolation` | Creates public teams, families, members, and team selections | Untouched |
| `20261003083500_hockey_family_guardian_invites` | Creates `hockey_family_invites` | Untouched |
| `20261003085000_hockey_family_game_logistics` | Creates `hockey_family_event_plans` | Untouched |
| `20261003090000_hockey_family_event_rsvp` | Creates `hockey_family_event_rsvps` | Untouched |
| `20261003152000_ahmv_product_catalog` | Creates seven catalog tables and seeds AHMV plans | Seed rows only in the new catalog tables |
| `20261003194500_ahmv_schedule_snapshot` | Creates `ahmv_schedule_snapshots` | Untouched |
| `20261003194500_takatak_ads_foundation` | Creates seven ad tables | Untouched |
| `20261004190000_community_content_moderation` | Creates eight contribution and reputation tables | Untouched |
| `20261005043500_ahmv_smart_departure_entitlement` | Inserts one entitlement link for Parent Premium | No customer rows |
| `20261006120000_takatak_billing_invoice_requests` | Creates `billing_invoice_requests` | Untouched |
| `20261006140000_client_stripe_connect_accounts` | Creates `client_stripe_connect_accounts` | Untouched. Later client deletes are restricted once a row exists |
| `20261006150000_billing_invoice_checkout_sessions` | Creates `billing_invoice_checkout_sessions` | Untouched |
| `20261008090000_website_lead_attachments` | Creates `lead_attachments` | Untouched. Later lead or client deletes cascade to attachments |

## Backup plan before any future apply

1. Leave `RECONCILE_MODE` on audit. This repository does not contain a backup of the staging database. A backup is not ready until someone takes one.
2. In the Supabase staging project `utuvzrqvivqyziibobvu`, take a logical backup of the whole database before any apply. Store it outside the app server. Confirm the backup includes `public` data, `public._prisma_migrations`, and `supabase_migrations.schema_migrations`.
3. Record row counts for customer, reservation, lead, and client tables before and after. Apply must not change those counts.
4. Do not run `prisma migrate deploy`, `prisma migrate reset`, or any SQL file by hand as part of this reconciliation.

## Rollback

- If a future approved run only records Prisma history for SQL that Supabase already applied, rollback is `prisma migrate resolve --rolled-back <name>` for those names. That changes history bookkeeping, not table data.
- This reconciler never rolls schema backward. Dropping the new tables would be a separate change and is not part of this work.
- Do not restore a backup over staging unless the backup was taken immediately before the change and the restore plan names the staging project ref.
- Production `pcjfahhlozsseqqevimi` is not a rollback target for staging.

## Live history

Read-only audit [37762369395](https://github.com/takatakca/takatak-v1/actions/runs/37762369395) ran on `0ee466acdecd41547c69bf2d3aecadf8a3f8c56e` at 2026-10-08T10:16:20Z. `RECONCILE_MODE` was `audit`. The approval step was skipped. The log ends with `AUDIT PASS. No staging mutation performed.` Project ref `utuvzrqvivqyziibobvu` was verified. The database URL was masked.

The same run's release listener [37762430242](https://github.com/takatakca/takatak-v1/actions/runs/37762430242) skipped `staging-release` before any step. No staging deploy started.

Equivalence uses `canonicalSql`: line endings, SQL comments, schema/table comments, whitespace, and double quotes are removed, then the text is lowercased. A mismatch fails the audit. This run did not fail, so every Supabase history row it matched is equivalent under that function. There is no SQL-mismatch class in this run.

| Class | Migrations |
| --- | --- |
| Already recorded in Prisma | `20261003062000_hockey_membership_foundation` |
| Supabase history matches repository SQL, Prisma history does not yet record it | the 18 names printed by the audit: parent team preferences, membership RLS lockdown, supporter grants, parent event engine, Google calendar, smart departure, family team isolation, guardian invites, game logistics, family event RSVP, AHMV product catalog, AHMV schedule snapshot, ads foundation, community content moderation, smart departure entitlement, billing invoice requests, client Stripe Connect accounts, billing invoice checkout sessions |
| Absent from both histories | `20261008090000_website_lead_attachments` |
| Outside this gate | 15 unrelated repository migrations. The audit prints the count only |

The 18 matching rows would, on a later approved apply, be recorded with `prisma migrate resolve --applied` and their SQL would not run again. `website_lead_attachments` is still pending, so that same apply would still refuse `prisma migrate deploy` and stop. Do not apply until a separate approval, a fresh backup, and a decision about that one pending file.
