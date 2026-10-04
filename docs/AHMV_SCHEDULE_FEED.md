# AHMV authoritative schedule bridge — GROUPE TAKATAK

## Purpose

This module gives AHMV Phone/SMS/Voice one normalized schedule source without pretending TAKATAK owns or creates hockey schedules.

The flow is:

```text
Official AHMV schedule source
        |
        | normalized snapshot + provenance
        v
POST /api/integrations/ahmv/schedule/ingest
        |
        v
TAKATAK ahmv_schedule_snapshots
        |
        v
GET /api/integrations/ahmv/schedule
        |
        +--> ahmverdun.ca SMS
        +--> AHMV Voice AI
        +--> reminder worker
```

TAKATAK is the secure distribution/cache layer. The upstream source remains the authority.

## Current official-source discovery

AHM de Verdun publicly directs families to its Rétroaction organization schedule. Rétroaction exposes the organization schedule publicly and provides calendar synchronization for categories/groups/teams/locations.

Do not scrape a static HTML shell and call it live data. The ingestion side must use a reviewed official export/API/calendar feed or a reviewed AHMV administrative publisher.

Until such an importer is configured, no fresh snapshot exists and the read API deliberately returns 503.

## Read API

```
GET /api/integrations/ahmv/schedule
Authorization: Bearer <TAKATAK_AHMV_SERVICE_TOKEN>
X-AHMV-Tenant: ahmverdun
```

Optional query parameters:

- `teamId` — stable public AHMV team identifier
- `team`
- `category`
- `date=YYYY-MM-DD`

Successful response:

```json
{
  "status": "active",
  "updatedAt": "2026-10-03T19:00:00.000Z",
  "sourceUrl": "https://official.example/schedule",
  "events": [
    {
      "id": "stable-event-id",
      "type": "Match",
      "team": "M13 A",
      "category": "M13",
      "startsAt": "2026-10-04T21:00:00.000Z",
      "endsAt": "2026-10-04T22:30:00.000Z",
      "status": "scheduled",
      "venue": "Auditorium de Verdun",
      "venueAddress": "4110 Boulevard LaSalle, Montréal, QC"
    }
  ]
}
```

If the stored source is missing, invalid or stale, the endpoint returns 503. It never converts an unavailable feed into a false `no_match`.

## Exact-team game API

AHMV team mini-sites consume the same fresh normalized snapshot through a stricter exact-team projection:

```
GET /api/integrations/ahmv/team-games?teamId={PUBLIC_TEAM_ID}
Authorization: Bearer <TAKATAK_AHMV_SERVICE_TOKEN>
X-AHMV-Tenant: ahmverdun
X-AHMV-Team-ID: {PUBLIC_TEAM_ID}
```

The query and `X-AHMV-Team-ID` header must match. This prevents a caller from using one authorized team context to request another team accidentally.

The endpoint never infers home/away orientation or scores from a generic opponent field. A next game is emitted only when the normalized event contains explicit public `homeTeam` and `awayTeam`. A final result additionally requires both official scores. Otherwise the endpoint stays connected but returns no fabricated game card, so ahmverdun.ca falls back to the official hockey source.

Response fields are limited to public schedule/result data: `id`, `startsAt`, team names, public scores, venue/address, status, official URL and scoresheet URL. Standings are omitted until an authoritative standings source is normalized.

## Ingestion API

```
POST /api/integrations/ahmv/schedule/ingest
Authorization: Bearer <TAKATAK_AHMV_INGEST_TOKEN>
X-AHMV-Tenant: ahmverdun
Content-Type: application/json
```

The read token cannot ingest. The ingestion token is separate so a compromised consumer cannot rewrite the schedule.

Accepted top-level payload:

```json
{
  "status": "active",
  "updatedAt": "2026-10-03T19:00:00.000Z",
  "sourceUrl": "https://official-source.example/ahmv",
  "events": []
}
```

Rules:

- `sourceUrl` must be HTTPS.
- `updatedAt` must be a real source timestamp, not the importer execution time unless the source itself was regenerated at that moment.
- timestamps over five minutes in the future are rejected.
- inputs older than 30 days are rejected.
- maximum 1000 public schedule events per snapshot.
- event IDs must be unique.
- `active` requires at least one event.
- `no_match` requires zero events.
- `scheduled`, `cancelled` and `final` are accepted.
- exact team mini-sites should include the stable public `teamId` when the official source provides it.
- `homeTeam`, `awayTeam`, `homeScore`, `awayScore` and `scoresheetUrl` are optional public game fields.
- a `final` event is accepted only when both team names and both non-negative official scores are present.
- no roster, player, child, guardian, email or phone data belongs in this payload.

## Ordering/idempotency

The store uses a serializable transaction.

- newer source timestamp -> replace current snapshot
- older source timestamp -> ignore as stale
- same timestamp + same content hash -> duplicate/no-op
- same timestamp + different content -> 409 conflict

This prevents delayed jobs from restoring an older schedule.

## Browser isolation

The backing table `ahmv_schedule_snapshots` has RLS enabled with zero browser policies.

The route is server-to-server only.

## Environment

```
TAKATAK_AHMV_SERVICE_TOKEN=
TAKATAK_AHMV_INGEST_TOKEN=
AHMV_SCHEDULE_MAX_AGE_MINUTES=360
```

Both tokens should be random server secrets of at least 32 characters and must never be exposed as `NEXT_PUBLIC_*`.

## AHMV consumer configuration

On ahmverdun.ca:

```
TAKATAK_AHMV_SCHEDULE_URL=https://takatak.ca/api/integrations/ahmv/schedule
TAKATAK_AHMV_SERVICE_TOKEN=<same read token>
AHMV_LIVE_SCHEDULE_MAX_AGE_MINUTES=360
```

The AHMV public-phone preflight refuses public launch/reminders without this authenticated HTTPS feed.

## Source onboarding remaining

The safest upstream candidate discovered for AHM Verdun is the Rétroaction organization schedule/calendar export already used by AHMV families.

The importer must be implemented only after the exact reviewed Rétroaction export/API/calendar URL is obtained. Until then, use the ingestion endpoint only with a reviewed official publisher. Never stamp a stale weekly PDF with a new `updatedAt` merely to make it look fresh.
