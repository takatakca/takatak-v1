# Supabase Security Advisor — TAKATAK inventory and RLS remediation

**Do not deploy** until this report’s after-state is confirmed in the live
Supabase Security Advisor and leaked-password protection is enabled.

Canonical SQL: `prisma/migrations/20260909170000_public_rls_and_fk_indexes/migration.sql`  
Tests: `npm run qa:rls` (static always; live User A/B/anon when `DATABASE_URL` is a Supabase Postgres)  
Prisma tenant isolation (RLS bypass path): `npm run qa:tenant-isolation`

This file is the complete before/after Advisor record. Production was not
modified from this workspace.

---

## Access-path analysis (why RLS was not enabled blindly)

| Path | Client | Role | Hits public tables? |
| --- | --- | --- | --- |
| Dashboard / API / RSC | Prisma `DATABASE_URL` | Table owner (bypasses RLS unless FORCE) | Yes — **primary** path |
| Login, OTP, cookies | `@supabase/ssr` + anon key | `anon` / `authenticated` JWT | No `.from(table)` in app code |
| Invites / admin auth | `getSupabaseAdminClient()` | Service role | Auth Admin API only |
| Browser bundle | `createSupabaseBrowserClient()` | Anon key only | Auth only; `server-only` on admin client |

Implication: enabling RLS does not change legitimate dashboard, registration,
OTP, workspace, or social flows. Those queries use Prisma and still **must**
pass `resolveDataScope` / `clientWhere`. RLS is the Data API backstop.

`FORCE ROW LEVEL SECURITY` is intentionally **not** set so Prisma keeps
working. Privileged access therefore still requires explicit tenant filters
in application code.

---

## Before — Advisor inventory (operator export)

The dashboard screenshot reported **59 issues**. The expanded export below is
the complete list used for this work.

### A. RLS Disabled in Public — Critical (59)

Every row is `public.*`, exposed through the default Data API schema, with
RLS off. Default Supabase grants typically give `anon` / `authenticated`
table privileges, so a leaked anon key plus (for authenticated) a JWT can
read or write these tables until RLS is on.

| # | Object | Data API | Typical grants (before) | RLS before | Policies before | App access | Remediation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `client_memberships` | Yes | ALL to anon/authenticated | Off | None applied in Prisma | Prisma | RLS + own-profile SELECT |
| 2 | `social_brand_account_assignments` | Yes | ALL | Off | None | Prisma | RLS + `has_client_access(clientId)` |
| 3 | `user_invitations` | Yes | ALL | Off | None | Prisma | RLS on, **no policy, no GRANT** (contains `tokenHash`) |
| 23 | `profiles` | Yes | ALL | Off | None | Prisma | RLS on, **no policy, no GRANT** (contains OTP hash columns) |
| 4 | `business_locations` | Yes | ALL | Off | None | Prisma | RLS + membership SELECT |
| 5 | `social_competitor_tracks` | Yes | ALL | Off | None | Prisma | RLS, **no policy, no GRANT** (`externalPageId`) |
| 6 | `social_competitor_snapshots` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 7 | `social_account_sync_states` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 8 | `stripe_webhook_events` | Yes | ALL | Off | None | Prisma (webhooks) | RLS, **no policy**, revoke grants |
| 9 | `_prisma_migrations` | Yes | ALL | Off | None | Prisma migrate | RLS, **no policy**, revoke grants |
| 10 | `social_provider_connections` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 11 | `social_oauth_states` | Yes | ALL | Off | None | Prisma | RLS, **no policy** (PKCE/state secrets) |
| 12 | `business_brands` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 13 | `workspace_role_permission_overrides` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 14 | `service_instances` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 15 | `integration_events` | Yes | ALL | Off | None | Prisma | RLS, **no policy** (payloads) |
| 16 | `integration_accounts` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 17 | `job_logs` | Yes | ALL | Off | None | Prisma | RLS, **no policy** |
| 18 | `reports` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 19 | `notifications` | Yes | ALL | Off | None | Prisma | RLS + own `profileId` |
| 20 | `audit_logs` | Yes | ALL | Off | None | Prisma | RLS, **no policy** |
| 21 | `social_onboarding` | Yes | ALL | Off | None | Prisma | RLS + own `profileId` |
| 22 | `jobs` | Yes | ALL | Off | None | Prisma | RLS + membership (`clientId` not null) |
| 23 | `profiles` | Yes | ALL | Off | None | Prisma | RLS on, **no policy, no GRANT** (contains OTP hash columns) |
| 24 | `campaigns` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 25 | `social_posts` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 26 | `approvals` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 27 | `social_analytics_daily` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 28 | `social_accounts` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 29 | `domain_assets` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 30 | `hosting_services` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 31 | `dns_records` | Yes | ALL | Off | None | Prisma | RLS via parent domain `clientId` |
| 32 | `ssl_certificates` | Yes | ALL | Off | None | Prisma | RLS via parent domain `clientId` |
| 33 | `provisioning_steps` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 34 | `ai_provider_events` | Yes | ALL | Off | None | Prisma | RLS, **no policy** |
| 35 | `ai_content_jobs` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 36 | `saved_ai_outputs` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 37 | `social_ad_accounts` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 38 | `social_ad_analytics_daily` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 39 | `brand_voices` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 40 | `clients` | Yes | ALL | Off | None | Prisma | RLS + `has_client_access(id)` |
| 41 | `workspace_custom_roles` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 42 | `report_sections` | Yes | ALL | Off | None | Prisma | RLS via parent report |
| 43 | `report_metrics` | Yes | ALL | Off | None | Prisma | RLS via parent report |
| 44 | `report_schedules` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 45 | `report_templates` | Yes | ALL | Off | None | Prisma | RLS + `has_any_workspace_membership()` |
| 46 | `report_shares` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 47 | `client_subscriptions` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 48 | `social_credentials` | Yes | ALL | Off | None | Prisma | RLS, **no policy** (encrypted tokens) |
| 49 | `local_listings` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 50 | `listing_citations` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 51 | `listing_reviews` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 52 | `listing_photos` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 53 | `local_visibility_snapshots` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 54 | `social_content_items` | Yes | ALL | Off | None | Prisma | RLS, **no policy, no GRANT** (`externalObjectId`) |
| 55 | `lead_sources` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 56 | `lead_campaigns` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 57 | `leads` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 58 | `lead_pipeline_stages` | Yes | ALL | Off | None | Prisma | RLS + membership |
| 59 | `lead_activities` | Yes | ALL | Off | None | Prisma | RLS + membership |

`supabase/sql/001–007` were **never applied via Prisma**, which is why Advisor
still showed RLS disabled. They are superseded. `001` also defined
`profiles_update_own`, which would have allowed a JWT holder to change
`profiles.role` through PostgREST. **No write policies ship in the new
migration.** If a write policy is added later it must use both `USING` and
`WITH CHECK`, plus column restrictions so `role` / membership cannot be
self-elevated.

### B. Leaked Password Protection Disabled — Auth (Critical/Warn)

| Object | Severity | Data API | Remediation |
| --- | --- | --- | --- |
| Auth (HaveIBeenPwned) | Auth setting | N/A | **Applies to stored Auth passwords**, not to TAKATAK email OTP. Registration, invitation completion, and Account → password update write a password into GoTrue. Daily login is OTP-only (`/api/auth/login` does not call `signInWithPassword`). Enable leaked-password protection so those password set/update paths reject known-breached secrets. It does **not** protect `profiles.otpHash` or OTP codes. |

**Still open as an Auth dashboard setting.** Enable it because TAKATAK stores
Auth passwords at registration / invitation / account update. Do not treat it
as OTP protection.

### C. Unindexed foreign keys (performance / lock risk, not tenant leaks)

Advisor listed these tables (some more than once for multiple FKs):

`ai_content_jobs`, `approvals` (×2), `business_locations`, `campaigns`,
`clients`, `integration_events`, `jobs`, `saved_ai_outputs` (×2),
`social_ad_accounts`, `social_ad_analytics_daily` (×2),
`social_analytics_daily`, `social_brand_account_assignments`,
`social_competitor_snapshots`, `social_competitor_tracks`,
`social_content_items`, `social_oauth_states` (×2),
`social_provider_connections`, `user_invitations`.

Indexes covering those FKs are in the same Prisma migration and `schema.prisma`.

### D. Unused indexes (INFO — not security-critical)

Advisor flagged many unused indexes across memberships, social, hosting,
reports, listings, and leads. **None were dropped.** Unused-index noise is
normal on a young database (`pg_stat` has not seen production query mix).
Dropping them would risk deleting indexes that exist for uniqueness,
partial uniques, or upcoming workers.

**Disposition:** accepted performance findings. Not a deploy blocker.

---

## Column security review (GRANT vs RLS)

PostgreSQL RLS filters **rows only**. It never hides columns.

Official GRANT/REVOKE behavior ([PostgreSQL REVOKE](https://www.postgresql.org/docs/current/sql-revoke.html)):

> if a role has been granted privileges on a table, then revoking the same
> privileges from individual columns will have **no effect**.

The first draft of this migration did `GRANT SELECT ON TABLE` then
`REVOKE SELECT (otpHash, …)`. That REVOKE is a no-op. `authenticated` would
still have been able to `SELECT "otpHash"` on any profile row the RLS policy
allowed — including the caller’s own row.

**Corrected model:** never grant table-level SELECT on a relation that stores
secrets. Secret-bearing tables are Prisma-only: RLS enabled, **zero policies**,
**zero grants** to `anon` / `authenticated`. If a table-level GRANT is later
restored by accident, the missing policy still yields zero rows.

`npm run qa:rls` includes a rolled-back probe that GRANTs table SELECT, REVOKEs
one column, then SELECTs that column as `authenticated` — it must still return
the secret, proving the no-op.

---

## Policy model (after migration)

Helpers live in schema **`private`**, which is **not** a PostgREST exposed
schema (`public` / `graphql_public` only). They are `SECURITY DEFINER` with
`SET search_path = pg_catalog` only — **not** `public`. Every relation is
schema-qualified (`public.profiles`, `public.client_memberships`, `auth.uid()`,
`public."ProfileStatus"`). `pg_catalog` is not writable by `anon`/`authenticated`.
`CREATE` is revoked on both `public` and `private` so those roles cannot plant
shadow objects. `authenticated` gets `USAGE` on `private` and `EXECUTE` on the
three helpers so RLS `USING` clauses can evaluate them. `PUBLIC` and `anon` have
neither schema access nor `EXECUTE`.

Identity is always `auth.uid()`. Arguments are **resource** IDs (a profile
row or a workspace), never a user id to impersonate. All three helpers return
**boolean** only (`current_profile_id()` is not installed). Public copies are
dropped so they cannot remain `/rpc` endpoints.

- `private.is_current_profile(uuid)` — true iff that profile row is the caller and `active`
- `private.has_client_access(uuid)` — true iff caller has an **active** membership on that client and an **active** profile
- `private.has_any_workspace_membership()` — true iff the caller has any such membership

There is **no** platform-admin bypass in Data API policies. Owner/admin
global views stay on Prisma (`platform_admin` + labeled UI).

Policies on `clients` / locations / assignments call `private.has_client_access`.
The function is DEFINER and keys only off `auth.uid()`, so it does not recurse
through invoker RLS. Own-row policies call `private.is_current_profile("profileId")`
instead of returning a profile UUID.

### SELECT (authenticated + predicate) — all columns on these tables are Data-API safe

| Class | Predicate |
| --- | --- |
| Own membership | `client_memberships` (`private.is_current_profile("profileId")`) |
| Own notifications / onboarding | `private.is_current_profile("profileId")` |
| Workspace rows | `private.has_client_access("clientId")` (or `id` on `clients`) |
| Child rows | parent workspace (`dns_records`, `ssl_certificates`, report sections/metrics) |
| Global templates | `private.has_any_workspace_membership()` |

### Deny Data API entirely (RLS on, zero policies, zero grants)

| Table | Sensitive columns / reason |
| --- | --- |
| `profiles` | `otpHash`, `otpExpiresAt`, `lastOtpRequestedAt`, `otpAttemptCount` |
| `user_invitations` | `tokenHash` |
| `social_oauth_states` | `stateHash`, `codeVerifierCiphertext`, `codeVerifierIv`, `codeVerifierAuthTag` |
| `social_credentials` | `encryptedPayload`, `iv`, `authTag` |
| `social_content_items` | `externalObjectId` |
| `social_competitor_tracks` | `externalPageId` |
| `social_provider_connections` | `metadata`, provider subject |
| `social_account_sync_states` | internal worker state |
| `jobs` | `leaseOwner`, `metadata` |
| `job_logs` | operational logs |
| `stripe_webhook_events` | webhook idempotency / routing |
| `integration_accounts` | `metadata` (integration-adjacent) |
| `integration_events` | `payload` |
| `audit_logs` | `metadata`, `ipAddress`, `userAgent` |
| `ai_provider_events` | provider observability |
| `_prisma_migrations` | migration history |

Invitations remain Prisma-only. App-layer authorization still limits who can
load an invitation; the Data API cannot.

### Writes

`REVOKE ALL` from `anon` and `authenticated` on every public table, then
`GRANT SELECT ON TABLE` only on the safe allow-list. No INSERT/UPDATE/DELETE
policies. No column-level GRANT lists, because secret tables are fully denied.

### Privilege matrix (anon / authenticated / Prisma)

Legend: **none** = no GRANT (and no policy unless noted). **SELECT** = table-level SELECT + membership/ownership policy. Prisma = table owner, RLS not FORCEd.

| Table | anon | authenticated | Prisma / postgres | Notes |
| --- | --- | --- | --- | --- |
| `profiles` | none, all columns | none, all columns including `otpHash` | full | Data API denied |
| `user_invitations` | none | none, including `tokenHash` | full | Data API denied |
| `client_memberships` | none | SELECT own row, all columns | full | Safe columns only |
| `clients` | none | SELECT if member, all columns | full | |
| `business_locations` | none | SELECT if member | full | |
| `social_brand_account_assignments` | none | SELECT if member | full | |
| `business_brands` | none | SELECT if member | full | |
| `service_instances` | none | SELECT if member | full | |
| `notifications` | none | SELECT own `profileId` | full | |
| `social_onboarding` | none | SELECT own `profileId` | full | |
| `report_templates` | none | SELECT if any membership | full | |
| `reports` | none | SELECT if member | full | |
| `report_sections` | none | SELECT via parent report | full | |
| `report_metrics` | none | SELECT via parent report | full | |
| `report_schedules` | none | SELECT if member | full | |
| `report_shares` | none | SELECT if member | full | |
| `campaigns` | none | SELECT if member | full | |
| `social_posts` | none | SELECT if member | full | |
| `social_accounts` | none | SELECT if member | full | |
| `social_competitor_snapshots` | none | SELECT if member | full | |
| `social_analytics_daily` | none | SELECT if member | full | |
| `social_ad_accounts` | none | SELECT if member | full | |
| `social_ad_analytics_daily` | none | SELECT if member | full | |
| `domain_assets` | none | SELECT if member | full | |
| `hosting_services` | none | SELECT if member | full | |
| `provisioning_steps` | none | SELECT if member | full | |
| `dns_records` | none | SELECT via parent domain | full | |
| `ssl_certificates` | none | SELECT via parent domain | full | |
| `brand_voices` | none | SELECT if member | full | |
| `ai_content_jobs` | none | SELECT if member | full | |
| `saved_ai_outputs` | none | SELECT if member | full | |
| `local_listings` | none | SELECT if member | full | |
| `listing_citations` | none | SELECT if member | full | |
| `listing_reviews` | none | SELECT if member | full | |
| `listing_photos` | none | SELECT if member | full | |
| `local_visibility_snapshots` | none | SELECT if member | full | |
| `lead_sources` | none | SELECT if member | full | |
| `lead_campaigns` | none | SELECT if member | full | |
| `leads` | none | SELECT if member | full | PII, tenant-scoped |
| `lead_pipeline_stages` | none | SELECT if member | full | |
| `lead_activities` | none | SELECT if member | full | |
| `workspace_custom_roles` | none | SELECT if member | full | |
| `workspace_role_permission_overrides` | none | SELECT if member | full | |
| `approvals` | none | SELECT if member | full | |
| `client_subscriptions` | none | SELECT if member | full | |
| `social_oauth_states` | none, all columns | none, all columns | full | PKCE secrets |
| `social_credentials` | none, all columns | none, all columns | full | encrypted tokens |
| `social_content_items` | none, all columns | none, all columns | full | `externalObjectId` |
| `social_competitor_tracks` | none, all columns | none, all columns | full | `externalPageId` |
| `social_provider_connections` | none | none | full | |
| `social_account_sync_states` | none | none | full | |
| `jobs` | none | none | full | |
| `job_logs` | none | none | full | |
| `stripe_webhook_events` | none | none | full | |
| `integration_accounts` | none | none | full | |
| `integration_events` | none | none | full | |
| `audit_logs` | none | none | full | |
| `ai_provider_events` | none | none | full | |
| `_prisma_migrations` | none | none | full | migrate still uses owner |

No INSERT/UPDATE/DELETE/TRUNCATE for `anon` or `authenticated` on any public table.

### Views / storage / SECURITY DEFINER / service role

| Area | Finding |
| --- | --- |
| Views | None used; no `security_invoker` views required because secret tables are fully denied |
| Storage policies | No Storage usage in app code |
| SECURITY DEFINER | `private.is_current_profile`, `private.has_client_access`, `private.has_any_workspace_membership`; `search_path = pg_catalog`; `USAGE`+`EXECUTE` to `authenticated` only; not in PostgREST exposed schemas |
| Service role | `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — never `NEXT_PUBLIC_*`; `supabase-admin.ts` is `server-only` |
| Realtime | Not used for these tables in app code; RLS still applies if added later |

---

## After — expected Advisor (once migration is deployed to the project)

Live Advisor has **not** been re-run against production from this session
(no production SQL was executed here). After `prisma migrate deploy` on the
Supabase database:

| Finding | Before | Expected after | Status |
| --- | --- | --- | --- |
| RLS Disabled in Public (59) | 59 Critical | **0** | Pending live Advisor |
| RLS enabled, no policy (deny-all tables) | n/a | Possible **INFO** on secret/operational tables | Secure; do not add open policies |
| Unindexed foreign keys | 21 | **0** | Pending live Advisor |
| Unused indexes | Many INFO | Unchanged | Accepted |
| Leaked Password Protection | Disabled | Enable if you want HIBP on **password set/update** (registration, invitation, account settings). Does not cover OTP login. | **Open — Auth dashboard** |

Advisor “RLS enabled but no policy” on secrets tables is the intended lock.
Do not “fix” those by adding `USING (true)` or `TO authenticated` without a
membership predicate.

---

## Required RLS proofs

| Requirement | How it is proven |
| --- | --- |
| User A sees only Workspace A | `scripts/check-rls-policies.ts` as JWT A |
| User B sees only Workspace B | Same, JWT B |
| A cannot access B by swapping IDs | Direct `WHERE id = B` returns 0 |
| B cannot access A | Mirror |
| Anonymous cannot read protected tables | `SET ROLE anon` → denied or 0 |
| Invitations only for participants | Data API denied for `user_invitations`; Prisma team routes remain the only path |
| Owner cannot SELECT own `otpHash` / `tokenHash` | `SET ROLE authenticated` + JWT A → permission denied or 0 |
| Table GRANT + column REVOKE is a no-op | Rolled-back probe in `qa:rls` |
| PostgREST anon | `GET /rest/v1/{secret-table}` with anon key after RLS is on |
| PostgREST helper RPCs | `POST /rpc/is_current_profile`, `/rpc/has_client_access`, `/rpc/has_any_workspace_membership` unavailable (404 / PGRST202); `Accept-Profile: private` also rejected |
| Membership lookup without profiles GRANT | A still SELECTs Workspace A via DEFINER helpers |
| Social assignments tenant-scoped | Assignment A/B probes |
| Locations tenant-scoped | Location A/B probes |
| Service-role key not in browser | Static read of `supabase-browser.ts` / `env.ts` / `supabase-admin.ts` |
| Prisma still tenant-scoped when RLS is bypassed | Prisma count sees both fixtures; `clientWhere` remains in `data-scope.ts`; `npm run qa:tenant-isolation` |
| Legitimate app flows | Unchanged access path (Prisma + Auth-only Supabase clients); no FORCE RLS |

Cookie/URL/body tampering for dashboard data remains enforced in
`computeTenantAccess` / `resolveDataScope` (existing identity tests), not in
Postgres, because the browser never queries these tables.

---

## What you must do on the Supabase project (not done here)

1. Deploy the migration to **staging**, not by clicking around in production SQL:
   `npx prisma migrate deploy`
2. `DATABASE_URL=… npm run qa:rls` against that database (User A/B/anon).
3. `npm run qa:tenant-isolation` on a disposable copy if you need the Prisma-layer proof.
4. Optionally enable **Leaked password protection** for GoTrue password create/update (not OTP).
5. Re-run **Security Advisor**. Paste the after-export next to this file.
6. Only then consider deploy. Critical Advisor rows must be gone or explicitly
   classified (INFO unused indexes; INFO “no policy” on deny-all secrets).

Do **not** apply this migration until the column-security review in this file
is accepted. Production was not modified.

---

## Readiness

**Not ready to deploy.** Column-security correction is in the repo. Live
Advisor after-state, staging `prisma migrate deploy`, `qa:rls` / tenant
isolation / app flow verification, and a decision on leaked-password
protection are still required.
