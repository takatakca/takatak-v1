# AHMV Parent Premium — backend release gates

This file defines the release path before any AHMV Parent Premium backend capability is surfaced in TAKATAK Dashboard or handed to the AHM Verdun frontend.

## Ownership boundary

- GROUPE TAKATAK: company / agency.
- TAKATAK Auth: identity and authorization.
- TAKATAK Dashboard backend: billing, entitlements, integrations, communications and orchestration.
- AHM Verdun frontend: public/team user experience.
- Official/public hockey systems remain the source of truth for schedules and results.

No dashboard UI integration should be treated as complete until the backend gates below pass.

## Gate 1 — isolated implementation

All new AHMV backend work starts in a dedicated feature branch.

Do not modify TAKATAK Dashboard presentation while the service contract is still changing.

## Gate 2 — source provenance and field filtering

Team-event ingestion accepts only the normalized public fields required for parent convenience:

- public source event ID
- exact public team ID
- event type/title
- start/end/timezone
- public arena name/address/coordinates
- public event status
- approved HTTPS source URL
- source revision timestamp

The parser intentionally discards any extra payload fields. Roster, player, guardian, medical, birth-date, private contact and other person-level fields are not copied into the normalized event model.

Production should set:

`AHMV_EVENT_REQUIRE_SOURCE_URL=true`

and explicitly configure:

`AHMV_EVENT_ALLOWED_SOURCE_HOSTS=`

with the exact verified public schedule hosts in use at cutover. See `docs/AHMV_PUBLIC_SOURCE_INVENTORY.md` for the current review inventory.

There is no implicit fallback allowlist. If signed AHMV event synchronization is enabled without an explicit allowlist, ingestion fails closed.

The source-host comparison is exact. A hostname such as `scoresheets.ca.evil.example` is rejected.

## Gate 3 — request authentication and browser write isolation

Browser-authenticated AHMV write routes must reject requests whose origin cannot be verified. Public/server callbacks such as Stripe webhooks, signed AHMV synchronization and the internal worker use their dedicated signature/token boundary instead of browser-origin checks.

Server-to-server AHMV integration requests require:

- dedicated integration ID
- dedicated HMAC secret
- event ID
- timestamp within the replay window
- body signature

Secrets are never stored in browser variables or committed to the repository.

## Gate 4 — data isolation

New operational tables must:

- use Prisma/server access only
- have row-level security enabled
- revoke PUBLIC, anon and authenticated Data API access
- avoid raw webhook bodies when not required
- avoid provider credentials in public/team data

## Gate 5 — entitlement, consent and exact-team validation

New or re-enabled parent preferences must resolve the exact public team ID against the active verified AHMV team registry. Fuzzy display-name matching is not accepted. Existing settings may still be turned off after a team becomes inactive.

External side effects must re-check immediately before execution:

- current TAKATAK identity
- active paid or complimentary entitlement
- exact feature entitlement
- channel consent
- verified destination such as phone number
- latest event revision

Queued jobs are not authorization. Authorization is re-evaluated at execution time.

## Gate 6 — automated quality

The CI pipeline must pass all of the following before merge:

- Prisma generation
- required-source checks
- static RLS checks
- TypeScript
- lint
- auth tests
- identity isolation
- AHMV hockey safeguards
- secret scan
- ephemeral local Supabase migrations
- live RLS/PostgREST checks
- Security Advisor equivalent
- application-flow tests
- tenant isolation
- production webpack build
- production artifact audit
- clean artifact startup

No red CI is overridden for an AHMV backend merge.

## Gate 7 — production configuration review

Before enabling a connector, verify the corresponding settings without printing secret values.

Stripe:
- `HOCKEY_MEMBERSHIP_SELF_SERVE_ENABLED=true`
- `STRIPE_SECRET_KEY`
- `STRIPE_HOCKEY_WEBHOOK_SECRET`
- approved AHMV Stripe price IDs

AHMV event synchronization:
- `AHMV_EVENT_SYNC_ENABLED=true`
- `AHMV_EVENT_SYNC_CLIENT_ID`
- `AHMV_EVENT_SYNC_WEBHOOK_SECRET`
- `AHMV_EVENT_REQUIRE_SOURCE_URL=true`
- approved `AHMV_EVENT_ALLOWED_SOURCE_HOSTS`

SMS:
- `HOCKEY_SMS_ENABLED=true`
- Twilio account/auth credentials
- Messaging Service SID or approved From number
- `HOCKEY_DELIVERY_WORKER_ENABLED=true`
- dedicated worker secret

Google Calendar:
- `HOCKEY_GOOGLE_CALENDAR_ENABLED=true`
- dedicated Google OAuth client
- exact production redirect URI
- hockey token encryption key
- validated calendar scopes

Smart departure:
- `HOCKEY_SMART_DEPARTURE_ENABLED=true`
- restricted Google Maps Routes API key
- dedicated hockey travel encryption key
- SMS delivery and internal worker enabled
- encrypted parent-approved origin only; no continuous-location history

Any incomplete connector stays disabled. The machine-readable readiness check must report the capability as not ready rather than partially enabling it.

## Gate 8 — staging/canary

For multi-guardian family sharing, invitation bearer tokens must be returned once, stored only as hashes, expire automatically, remain capped per family and be replay-protected. The accepting person must authenticate through TAKATAK Auth; an invitation never creates a roster identity.

Before frontend integration:

1. use synthetic TAKATAK identities;
2. ingest synthetic public team events;
3. verify that extra private-looking fields are discarded;
4. verify duplicate/stale events do not duplicate jobs;
5. verify an unsubscribed identity cannot enable or execute Premium actions;
6. verify an opted-out identity receives no SMS/calendar side effect;
7. verify cancellation/update behavior;
8. verify retry behavior without duplicate external messages/events;
9. verify logs contain no secrets or raw OAuth tokens;
10. verify an unknown or inactive team ID cannot enable parent Premium preferences;
11. verify cross-origin browser writes are rejected;
12. verify smart-departure coordinates remain encrypted and route/location history is not persisted;
13. verify a second guardian cannot see a family before accepting a valid invitation;
14. verify the accepted guardian can see the shared family afterward;
15. verify the same guardian invitation cannot be replayed;
16. verify a child can be assigned a driver only when that child is assigned to the event's exact public team;
17. verify the selected driver is an authenticated guardian in the same family;
18. verify shared driving responsibility stores no route history or precise pickup/dropoff coordinates;
19. verify private family RSVP is visible only to authenticated guardians in the same family;
20. verify RSVP requires the child's exact verified team assignment and stores no medical reason, free-form absence note or official roster attendance;
21. verify the family owner can revoke another guardian without requiring Premium entitlement;
22. verify the family owner cannot remove themselves;
23. verify a removed guardian loses family access immediately, their future driving plans are cancelled and their pending invitations are revoked.

## Gate 9 — developer integration handoff

Only after the backend contract is stable and green should the frontend/dashboard developer receive:

- endpoint paths
- request/response schemas
- feature flags
- error/status codes
- callback URLs
- source-of-truth rules
- test identities/scenarios
- production enablement checklist

The frontend must not derive Premium access from browser state.

## Gate 10 — controlled enablement

Enable one capability at a time:

1. membership status
2. parent preferences
3. official event ingestion
4. calendar sync
5. SMS reminders
6. smart departure
7. family/community services

Observe each capability before moving to the next one.

Rollback is feature-flag first: disabling a connector must stop new external actions without deleting historical audit/state records.
