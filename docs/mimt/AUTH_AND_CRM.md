# TAKATAK AUTH first — engineering contract and CRM boundaries

**Priority P0.** Owner's single developer task: [#141](https://github.com/takatakca/takatak-v1/issues/141). No second auth app or repo. Do not rewrite the working Supabase Auth session system.

## Concrete bug map (checked against `main` on 2026-10-08)

- `src/components/auth/master-phone-login-form.tsx`: `mode` initializes to `email`; desired phone-first after a real staging Twilio/Supabase provider test.
- `src/components/auth/master-phone-registration-form.tsx`: email must validate even for phone-only registration; OTP calls `supabase.auth.signInWithOtp({phone, options:{shouldCreateUser:true}})`. Need phone-only with optional verified email captured later.
- `src/components/auth/otp-form.tsx`: phone uses `supabase.auth.verifyOtp({phone, token, type:"sms"})`; on success calls server `/api/auth/sync-profile`. Preserve as canonical trust chain.
- `src/lib/auth/profile-sync.ts`: `getProfileIdentity` requires valid `user.email` or unverified `user_metadata.email` even when `phone_confirmed_at` is valid. **Phone-only login can fail profile sync.** Treat metadata as unverified; do not issue fabricated email strings.
- `prisma/schema.prisma`: `Profile.email String @unique` is mandatory but `MasterIdentity.primaryEmail String? @unique` is optional. Migrate Profile.email with a migration-safe nullability/affected-workflow plan; protect existing users, unique constraints, Client creation, invitations, billing, outbound email and admin UI.
- Legacy `/api/auth/{login,verify-otp,resend-code}` phone paths deliberately reject phone branch. Avoid re-enabling old OTP session authority. Older `takatakbackend` Phone/SMS OTP code requires dependency inventory before decommission.
- `src/lib/ops/env-preflight.ts` detects environment variable presence, but that is not a live Supabase->Twilio phone OTP delivery test.
- Staging exists in Supabase; do not assume deployed site uses it. Verify actual ref per deployment and isolate test/prod keys.

## Target canonical flow

```text
Phone (+E.164) / existing email login
  -> server-supported Supabase Auth phone OTP through configured Twilio sender
  -> Supabase verifies code, issues authenticated session
  -> trusted origin server request /api/auth/sync-profile
  -> Profile + MasterIdentity transaction, unique verified phone mapping
  -> profile belongs to authorized Client/BusinessBrand memberships
  -> display correct dashboard tenant, or safe personal workspace
  -> later cross-product authorization: scoped short-lived MIMT assertion / business relationship event
```

### What to build and test

1. Verify current Supabase Auth Phone Twilio integration and test *real* delivery/verification to Canadian phone on staging. Include retry, throttle, wrong/expired code, disabled number, fraud/spend limits and neutral client error messages.
2. Make phone-only signup/login work without email. Use real verified auth identity; separate `emailVerified` from `phoneVerified`. Preserve email-based OTP + independent recovery for existing accounts; new phone-only users need a legitimate recovery procedure.
3. Database migration behind gated rollout: make email optional where business logic allows; audit all `Profile.email` dereferences, Client/workspace `email` assumptions, Prisma queries, uniqueness and older email-only accounts. Migrations require approved staging/production migration train; no guesswork.
4. Idempotent profile sync + master identity. Never merge identities only because a user typed someone else's email or claimed a phone; handle recycled numbers/conflicts and account recovery. Keep `raw_user_meta_data` outside trust decisions and RLS.
5. Server-enforced membership/tenant isolation, secure cookies/session refresh, lost phone/email fallback, logout/revoke, developer/admin MFA where feasible.
6. Admin health: `not_configured`, `configured_untested`, `verified_staging`, `verified_production`, `error` for SMS, email, profile sync. Never claim a working flow based on configured env vars.

## TAKATAK CRM / MIMT subscriber ownership

TAKATAK may store *its own*:
- Agency client, business contract/commission relationship, authorized sales lead, contact provided for services, service-delivery actions, referral attribution and auditable provider order IDs.
- Stable global `MasterIdentity.id` linked to MIMT's **separate** `subscriber_id` only with proper identity verification, purpose and agreement.
- Minimal privacy-bounded event projection, e.g. `source_app: "mimt"`, `source_external_id`, `event_type: service_activated`, `tenant_id`, `occurred_at`, `legal_basis/consent_source`, version, idempotency key.

MIMT independently controls carrier lines, subscriber-specific contracts, DID rental, calls, messages, recordings, E911 address, usage ledger and customer support. TAKATAK has **no automatic right to ingest** these communications into general knowledge/AI. Consent for marketing is never implied by phone auth or essential service sign-up. Confidential business data can be queried only by scoped tenant/role and legitimate purpose; honor Quebec Law 25, account deletion/export/withdrawal and client offboarding. The agency may retain only records it is entitled to retain after MIMT buyout.

**No 'client lock-in' by withholding subscriber portability, failing to release phone numbers or concealing ownership.** The commercial five-year managed agreement controls software handoff; consumer rights and data portability remain independent.

## Evidence required to mark AUTH DONE

- Auth trace with redacted Supabase sender/provider config; 2 real Canadian handset SMS deliveries; new phone-only signup, login and second login; verified `phone_confirmed_at`; correct MasterIdentity; email addition + optional recovery.
- Invalid/expired/replayed OTP; rate-limit responses; idempotent repeated profile sync; phone/email collisions; disabled user; simultaneous signup; tenant A cannot query B; session expiry/revoke.
- CI tests, typecheck, lint, migration dry run + rollback, staging URL and live-real-provider evidence; a reviewable branch/PR only; no prod auth switch until go-ahead.
- Report all blockers and next human action in #141 / `WORKLOG.md`.
