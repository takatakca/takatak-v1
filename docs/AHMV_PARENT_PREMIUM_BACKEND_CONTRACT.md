# AHMV Parent Premium — Frontend / Backend Integration Contract

Status: backend integration contract for staged implementation. This document does **not** mean that Stripe, Twilio, Google Calendar, Google Routes or AHMV event synchronization are enabled in production. Each connector remains disabled until its production secrets, provider configuration and release gates pass.

## Product boundary

- **GROUPE TAKATAK** is the company / agency.
- **TAKATAK Auth** is the identity layer.
- **TAKATAK Dashboard backend** owns billing, entitlements, preferences, integrations, communication jobs and operational state.
- **AHM Verdun** owns the parent/team user experience.
- AHM Verdun must never infer Premium access from browser state.
- AHM Verdun must never store Stripe, Twilio, Google OAuth or other provider secrets/tokens in browser code.
- Public team data is keyed by the exact verified AHMV public team ID. Do not join teams by display name.

## Authentication

All parent-facing endpoints require a valid TAKATAK authenticated session.

Typical failures:

- `401`: sign in required.
- `402`: Premium entitlement required.
- `403`: identity/origin/permission denied.
- `404`: requested verified resource does not exist.
- `400`: validation error.
- `503`: backend/provider temporarily unavailable.

Browser-authenticated writes must pass same-origin validation.

## Membership

### GET /api/billing/hockey/membership

Returns the server-derived membership snapshot.

Important fields:

```json
{
  "ok": true,
  "membership": {
    "access": "paid",
    "accessSource": "stripe",
    "status": "active",
    "planCode": "hockey_member_weekly_10",
    "planName": "AHMV Member",
    "displayWeeklyCad": 10,
    "currentPeriodEnd": null,
    "cancelAtPeriodEnd": false,
    "complimentaryUntil": null,
    "availableThankYouWeeks": 0,
    "features": [
      "game_reminders",
      "calendar_sync",
      "smart_departure"
    ]
  }
}
```

The frontend must use `features` from this response to decide which controls to show as enabled. Do not reconstruct entitlements from price, plan name or local storage.

### POST /api/billing/hockey/checkout

Starts Stripe Checkout for a supported self-serve hockey plan.

Input:

```json
{
  "planCode": "hockey_member_weekly_10"
}
```

Success:

```json
{
  "ok": true,
  "url": "https://checkout.stripe.com/..."
}
```

The frontend redirects to the returned HTTPS URL. It does not mark the user Premium. Premium becomes active only after the signed Stripe webhook updates TAKATAK.

### POST /api/billing/hockey/portal

Returns the Stripe customer portal URL for the authenticated member.

### POST /api/billing/hockey/supporter-credit/redeem

Activates the next available supporter thank-you credit when eligible.

The thank-you entitlement is a service benefit, not a donation/tax receipt record.

## Parent team preferences

### GET /api/hockey/parent/preferences

Returns preferences for the authenticated identity, separated by exact public `teamId`.

### PUT /api/hockey/parent/preferences

Example:

```json
{
  "teamId": "2025191400017862",
  "smsReminders": true,
  "calendarSync": true,
  "departureAlerts": true,
  "arrivalBufferMinutes": 30
}
```

Rules:

- `teamId` must be the exact public team ID.
- enabling a feature requires the corresponding current server entitlement;
- enabling SMS/calendar/departure records the related consent timestamp;
- disabling the option clears its consent timestamp;
- workers re-check consent and entitlement again immediately before an external action.

Current feature mapping:

- `smsReminders` -> `game_reminders`
- `calendarSync` -> `calendar_sync`
- `departureAlerts` -> `smart_departure`

## Family / multiple children

### POST /api/hockey/family

Creates or restores the authenticated guardian's default AHMV family container.

### GET /api/hockey/family

Returns only families where the authenticated TAKATAK identity is an active guardian.

### POST /api/hockey/family/:familyId/children

Input:

```json
{
  "displayName": "Prénom affiché"
}
```

Creates an unlinked child profile with a stable internal member code. No AHMV roster import is required.

### PUT /api/hockey/family/:familyId/members/:memberId/teams

Input:

```json
{
  "teamId": "2025191400017862",
  "selectionType": "assigned"
}
```

`assigned` is for child profiles. `favorite` may be used by a guardian.

The team must exist as an active record in the verified public team registry.

### DELETE /api/hockey/family/:familyId/members/:memberId/teams

Uses the same payload to remove the exact selection.

### GET /api/hockey/family/:familyId/schedule?from=<ISO>&to=<ISO>

Returns:

- each family member;
- that member's exact teams;
- only events matching those exact team IDs;
- a family-wide aggregate for convenience.

The backend does not use fuzzy team-name matching. Near-match IDs must not cross between children.

## Guardian sharing

A hockey family can include multiple authenticated guardians without importing roster data or storing invitation email/phone addresses.

### POST /api/hockey/family/:familyId/invites

Creates a one-time guardian invitation. The backend returns the bearer token once. Only its SHA-256 hash is stored.

### GET /api/hockey/family/:familyId/invites

Returns safe invitation metadata only; invitation bearer tokens are never returned again.

### DELETE /api/hockey/family/:familyId/invites/:inviteId

Revokes a pending invitation.

### POST /api/hockey/family/invites/accept

Input:

```json
{
  "token": "<one-time invitation token>"
}
```

The family owner must currently hold the `family_sync` entitlement, and the accepting person must already be authenticated through TAKATAK Auth. The token is one-time, expires after seven days, is replay-protected and cannot be accepted by the inviter. Acceptance links the authenticated identity to the existing family as an active guardian. No child roster identity is created from the invitation.

## Google Calendar

### POST /api/hockey/calendar/google/start

Starts identity-scoped Google Calendar OAuth using PKCE.

Success:

```json
{
  "ok": true,
  "url": "https://accounts.google.com/..."
}
```

### GET /api/hockey/calendar/google/callback

OAuth callback handled by TAKATAK. The AHM frontend should not process Google tokens.

### GET /api/hockey/calendar/google/status

Returns connection state and safe display metadata only.

### POST /api/hockey/calendar/google/disconnect

Revokes TAKATAK's stored connection state, clears encrypted credentials and skips pending calendar jobs.

Calendar access/refresh tokens and PKCE verifiers are encrypted at rest. They are never returned to AHM Verdun.

## Smart departure / traffic alert

### GET /api/hockey/travel/origin

Returns only safe origin configuration metadata. Precise coordinates are not returned in the summary.

### PUT /api/hockey/travel/origin

Input:

```json
{
  "latitude": 45.5017,
  "longitude": -73.5673,
  "label": "Maison"
}
```

The precise parent-approved start point is encrypted before persistence.

### DELETE /api/hockey/travel/origin

Removes the stored departure origin and cancels queued departure work.

Smart departure:

1. receives an official/public team event;
2. uses the parent-approved origin;
3. calculates a traffic-aware driving duration close to event time;
4. includes the configured arrival buffer;
5. rechecks traffic as departure approaches;
6. sends a localized SMS only when the parent is approaching the leave-by window.

No continuous GPS tracking or route-history database is part of this service.

## Server-to-server AHMV event synchronization

These endpoints are not called by browser code.

### POST /api/integrations/ahmv/team-directory

Signed HMAC event used to synchronize the approved public team registry.

Directory records contain public team identifiers/labels only. Roster, birth date, private contact, medical and similar person-level fields are discarded.

### POST /api/integrations/ahmv/team-events

Signed HMAC event used to upsert normalized public games/practices/events.

Production event ingestion must require:

- an approved exact HTTPS source host from the explicit production allowlist;
- no implicit fallback domain list;
- a valid integration ID;
- event ID;
- timestamp inside the replay window;
- valid HMAC signature.

## Delivery worker

### POST /api/internal/hockey/delivery/run

Internal server-only worker endpoint.

It processes due:

- SMS reminders / event changes;
- Google Calendar synchronization;
- smart-departure traffic checks.

Every side effect is re-authorized at execution time using current identity, entitlement, consent, verified destination and current event revision.

The browser never calls this endpoint.

## Frontend behavior expected from AHM Verdun

The AHM Verdun frontend should:

1. authenticate through TAKATAK Auth;
2. request the membership snapshot;
3. associate family members only with exact public team IDs;
4. request family/member schedules from TAKATAK rather than combining children by team name;
5. expose Premium toggles only according to returned features;
6. call preference APIs when the parent opts in/out;
7. open provider URLs returned by TAKATAK for Stripe or Google OAuth;
8. never claim a payment, calendar connection or alert is active until the backend confirms it;
9. provide clear states for disabled, connecting, active, expired, cancelled and temporarily unavailable services.

## Production gates before frontend cutover

Do not switch the AHM frontend to live backend behavior until:

- CI is green;
- Prisma migrations pass on ephemeral Supabase;
- RLS/PostgREST checks are green;
- build/artifact/startup tests are green;
- exact source allowlist is configured from the reviewed public source inventory;
- Stripe webhook and approved Price IDs are configured;
- Twilio sender/messaging service and worker secret are configured;
- Google OAuth callback and encryption keys are configured;
- Google Routes API key is restricted and billing is verified;
- synthetic parent/family/team canary scenarios pass;
- logs are verified not to contain secrets or raw OAuth tokens.

Until then, the frontend may expose UI in demo/disabled states, but must not fake successful backend actions.
