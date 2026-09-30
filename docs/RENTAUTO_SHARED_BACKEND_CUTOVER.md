# Rentauto shared TAKATAK backend cutover

## Goal

Move Rentauto from its legacy Supabase project to the shared TAKATAK Supabase
project without losing users, vehicles, trips, payments, private documents,
tracking history, or role boundaries.

The production Rentauto deployment is intentionally blocked by the GitHub
repository variable `RENTAUTO_SHARED_BACKEND_CUTOVER_APPROVED`. It must remain
unset/false until every gate below is complete.

## Authority model after cutover

- TAKATAK Supabase Auth: one user identity, email verification and OAuth.
- `public.profiles`, `public.master_identities`: shared TAKATAK identity.
- `rentauto.*`: Rentauto-only operational data and permissions.
- Stripe: payment authority; booking is confirmed only by verified webhook.
- Exact GPS, trip inspection photos and identity documents stay inside the
  Rentauto domain/private storage and are not copied into the master CRM
  projection.

## Gate 1 — legacy inventory

Run from a trusted operator environment only:

```bash
RENTAUTO_LEGACY_SUPABASE_URL="https://<legacy-project>.supabase.co" \
RENTAUTO_LEGACY_SUPABASE_SERVICE_ROLE_KEY="<legacy service role>" \
TAKATAK_SUPABASE_URL="https://pcjfahhlozsseqqevimi.supabase.co" \
TAKATAK_SUPABASE_SERVICE_ROLE_KEY="<TAKATAK service role>" \
npm run qa:rentauto-cutover-inventory
```

The command is read-only and prints counts only. It never prints either key.

Do not migrate if source/target queries fail or if the projects resolve to the
same host unexpectedly.

## Gate 2 — identity mapping

Run the read-only mapping gate before writing any identity links:

```bash
RENTAUTO_LEGACY_SUPABASE_URL="https://<legacy-project>.supabase.co" \
RENTAUTO_LEGACY_SUPABASE_SERVICE_ROLE_KEY="<legacy service role>" \
TAKATAK_SUPABASE_URL="https://pcjfahhlozsseqqevimi.supabase.co" \
TAKATAK_SUPABASE_SERVICE_ROLE_KEY="<TAKATAK service role>" \
npm run qa:rentauto-cutover-map-identities
```

The command compares only verified email/phone identifiers, prints aggregate
counts only, and performs no writes. Any conflict stops automatic migration.

For each legacy Rentauto user:

1. Normalize verified email and verified phone.
2. Resolve the TAKATAK `MasterIdentity`.
3. Preserve the legacy Rentauto auth UUID in
   `public.source_profiles.externalUserId` and
   `rentauto.accounts.legacy_user_id`.
4. Use the shared TAKATAK auth UUID for new Rentauto foreign keys.
5. Record ambiguous email/phone matches as conflicts. Never auto-merge a
   conflict.
6. Never grant host/admin based on user metadata.
7. Existing host status must be reviewed/migrated explicitly into the
   Rentauto role/application model.

Password/session hashes are not copied by application migration scripts. If
legacy Auth users cannot be migrated through a supported Auth migration path,
use account recovery/password reset rather than inventing passwords.

## Gate 3 — operational data migration

Migrate in dependency order:

1. accounts / identity mapping
2. host application + verification summaries
3. cars
4. car photos / extras / policies / host preferences
5. trips + booking references + authoritative pricing snapshots
6. availability blocks
7. favorites / reviews
8. Stripe Connect account references (never secret keys)
9. incidents / support / notifications
10. concierge threads / itineraries
11. tracking device/session/history only when retention requirements require it
12. private storage objects using namespaced Rentauto buckets

All user and host foreign keys must be translated through the verified identity
mapping. Never assume old auth UUID equals new shared auth UUID.

## Gate 4 — reconciliation

Required before cutover approval:

- source and target active vehicle counts reconcile
- all non-cancelled future trips reconcile
- booking references remain unique
- confirmed/paid trips preserve amount + currency + state
- every migrated trip resolves guest + vehicle + host
- no overlapping confirmed booking blocks
- private storage paths resolve only for permitted trip/host users
- host roles do not grant permissions in unrelated TAKATAK services
- customer dashboard sees correct trip/payment summaries
- TAKATAK dashboard sees the same master identity and Rentauto projection

## Gate 5 — real staging E2E

With real provider test credentials:

- signup / email OTP / login / logout / recovery
- Google OAuth return
- guest booking from quote through Stripe test checkout
- verified Stripe webhook confirmation
- duplicate booking race
- check-in
- tracking only during active trip
- incident/photo upload
- check-out
- receipt/review
- host application approval from TAKATAK
- host Stripe Connect onboarding/status
- mobile 360/390/414
- RLS cross-account probes

## Gate 6 — production configuration

Before deployment:

- shared TAKATAK Auth redirect allow-list includes Rentauto production routes
- Rentauto Stripe webhook endpoint is registered and secret installed
- `STRIPE_SECRET_KEY` installed server-side
- `RENTAUTO_STRIPE_WEBHOOK_SECRET` installed server-side
- `RENTAUTO_PUBLIC_APP_URL=https://rentauto.ca`
- GPS provider secret installed if a real provider is connected
- AI provider secret installed if concierge is enabled
- leaked-password protection enabled in Supabase Auth
- production backup/export captured
- rollback release confirmed on MochaHost

## Gate 7 — cutover

Only after the above gates pass:

1. Freeze legacy Rentauto writes for the final delta window.
2. Run the final delta migration.
3. Reconcile users/cars/future trips/payments again.
4. Set GitHub repository variable:
   `RENTAUTO_SHARED_BACKEND_CUTOVER_APPROVED=true`.
5. Merge the reviewed TAKATAK integration first.
6. Merge the reviewed Rentauto shared-backend branch second.
7. Allow the existing MochaHost automatic deployment to publish Rentauto.
8. Run production smoke tests.
9. Keep legacy project read-only during rollback window.

## Rollback rule

If production auth, vehicle discovery, checkout, trip access or RLS validation
fails, roll the Rentauto web release back immediately. Do not delete the shared
TAKATAK migrated data; correct it forward after customer traffic is protected.
