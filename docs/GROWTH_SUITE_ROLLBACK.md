# Growth Suite: how to go back

This runbook covers every change on branch `claude/festive-newton-5i9rv7`. It follows [TAKATAK_V1_ROLLBACK_PLAN.md](TAKATAK_V1_ROLLBACK_PLAN.md): roll back the app first and fix forward. Restoring the database is the last resort.

## Where things stand

- **`main` is untouched.** All Growth Suite work lives on this branch. Nothing is merged, deployed or applied to staging or production.
- **The migrations are gated.** None of the Growth migrations are in `APPROVED_DEPLOY_MIGRATIONS`, in either `scripts/reconcile-staging-migrations.mjs` or `scripts/reconcile-production-migrations.mjs`, so the reconcilers will not apply them. Approve them one at a time, staging first.
- **Every phase is a single commit.** Each one can be reviewed, kept or reverted on its own:

| Commit | Change | Migration |
|---|---|---|
| `3f58a49` | Phase 1: connectors hub, SEO site audit, reputation and AI Engine pages | none |
| `94ea93d` | Phase 2: reputation backend, AI credit ledger | `20261006120000_growth_reputation_and_ai_credits` |
| `95954b3` | Phase 3: first-party analytics, audiences, web chat | `20261006150000_growth_analytics_and_conversations` |
| `cec90d7` | Phase 4: automatic delivery, credit checkout, AI agent queue | `20261006180000_growth_agents_and_delivery` |
| `dad7899` | Phase 5: agent schedules, low-rating trigger, review → lead | `20261006210000_growth_agent_schedules` |
| `f833f35` | Phase 6: review showcase, Chat Concierge, Web Vitals | `20261007090000_growth_review_showcase` |
| `68a321c` | Phase 7: GA4, Search Console, monthly report | `20261007120000_growth_google_data_sources` |
| `a9d14f8` | Phase 8: Google Business Profile | `20261007150000_growth_google_business_profile` |
| `3a0a24a` | Phase 9: plan subscriptions and entitlements | `20261007180000_growth_plan_subscriptions` |
| `7f84125` | Security fix: Google links require verified website ownership | `20261007210000_growth_site_domain_verification` |
| `5758789` | This rollback runbook and down script | none |
| `9aa5702` | Fixes for 10 code-review findings (billing order, chat polling, client IP, agents, DST) | none |

## Level 1: switch features off (no deploy, no data change)

Remove the variable or set it to `false`, then redeploy. Each feature then reports "not configured" instead of failing.

| Variable | Effect when unset or `false` |
|---|---|
| `TAKATAK_AI_GATEWAY_TOKEN` | `/api/ai/*` (credits, agents, chat, review replies) returns 503 |
| `CRON_SECRET` | the Growth cron routes refuse to run |
| `GROWTH_SMS_ENABLED`, `GROWTH_WHATSAPP_ENABLED` | no automatic SMS or WhatsApp |
| `AI_CREDITS_CHECKOUT_ENABLED`, `GROWTH_BILLING_ENABLED` | no Stripe checkout for credits or plans |
| `GOOGLE_BUSINESS_PROFILE_ENABLED` | no Google Business Profile connect or sync |
| `GOOGLE_SERVICE_ACCOUNT_*`, `PAGESPEED_API_KEY` | no GA4, Search Console or Web Vitals calls |
| `GROWTH_ENTITLEMENTS_ENFORCED` | plan gates off (the pilot default) |

## Level 2: roll back the app (data kept)

- **Already deployed:** promote the previous known-good deployment, as in the V1 plan.
- **In git:** revert the phases you don't want, newest first, on a new branch, through a PR:

  ```bash
  git revert --no-edit 7f84125 3a0a24a   # example: drop the security fix and phase 9
  ```

- **No database change is needed.** Every Growth migration only adds new tables, columns, enum values and constraints. Older code simply never reads them, so leaving them in place is safe and matches the forward-fix policy.

## Level 3: remove the Growth database objects (last resort)

`scripts/rollback/growth-suite-down.sql` returns a database to `main`'s exact schema. It:

- drops all Growth tables and enums;
- removes the four Growth permissions from roles, memberships and invitations;
- deletes the Growth rows from `_prisma_migrations`.

It runs in one transaction, so it either fully applies or changes nothing.

**It deletes Growth data.** That covers ratings, chat, analytics, AI credits, agent runs, Google connections and plan subscriptions.

Order matters:

1. Deploy the Level 2 app rollback first, so no running code uses the Growth tables.
2. Back up the Growth data:

   ```bash
   pg_dump "$DIRECT_URL" --data-only \
     -t review_profiles -t review_requests -t review_responses \
     -t ai_credit_accounts -t ai_credit_entries \
     -t analytics_sites -t analytics_events -t analytics_audiences \
     -t chat_widgets -t chat_conversations -t chat_messages \
     -t ai_agent_settings -t ai_agent_runs \
     -t google_business_connections -t google_business_oauth_states \
     -t google_business_locations -t external_reviews \
     -t growth_subscriptions -t growth_billing_events \
     > growth-suite-backup.sql
   ```

3. Run the rollback, stopping on the first error:

   ```bash
   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/growth-suite-down.sql
   ```

4. Verify against `main`'s schema. Only drift that already exists on `main` may remain:

   ```bash
   git show origin/main:prisma/schema.prisma > /tmp/main.prisma
   npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel /tmp/main.prisma --script
   ```

To go forward again later, run `npx prisma migrate deploy`. The migrations re-apply cleanly.

### How the script was verified

Tested on 2026-10-07 on disposable Postgres 16 databases:

- Applied all Growth migrations and seeded Growth rows, plus a custom role holding `view_reputation`, `manage_conversations` and `view_ads`.
- Ran the down script:
  - the role kept only `view_ads`;
  - the client row was preserved.
- Compared the result with a database built from `main`'s migrations alone:
  - `pg_dump --schema-only` (privileges included) showed **no difference**;
  - the `_prisma_migrations` history was identical.
- Re-applied the migrations with `prisma migrate deploy`, which succeeded.

Re-run this check whenever a new Growth migration is added. The script must also be regenerated so it includes the new migration.

## What is *not* on the branch

The client-independence model in `takatakca/knowledgeAI` (docs 10–12) has **not** been implemented. That covers commercial states, lead provenance and transfer packages. A design is waiting for team review before any code lands.
