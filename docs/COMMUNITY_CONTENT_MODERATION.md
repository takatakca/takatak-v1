# TAKATAK Community Content Engine

Status: backend foundation for moderated community contributions. AHMV is the first publisher.

## Product rule

TAKATAK owns the reusable contribution, moderation, reputation and delivery engine.

AHM Verdun remains an independent public hockey product. It consumes this engine through a server-to-server publisher contract. AHMV does not need to duplicate contributor logic, moderation queues, points, badges or moderator email delivery.

The engine follows:

```text
Public content
    ↓ sync safe public snapshot
TAKATAK ManagedContentItem
    ↓ suggestion
ContentContribution
    ↓ machine pre-screen
Human moderation
    ↓ approved
ContentPublication / overlay
    ↓ publisher delivery
AHMV applies + acknowledges
    ↓
Version / audit / reputation
```

A suggestion never writes directly to a website, league system or official schedule source.

## First publisher: AHMV

Publisher code:

```text
ahmv
```

AHMV resolves to the active TAKATAK brand whose website is:

```text
https://ahmverdun.ca
```

The content bridge uses a dedicated server secret:

```text
TAKATAK_AHMV_CONTENT_TOKEN
```

It is intentionally separate from:

- `TAKATAK_AHMV_SERVICE_TOKEN` schedule reads;
- `TAKATAK_AHMV_INGEST_TOKEN` official schedule writes.

Every AHMV integration request also sends:

```text
X-AHMV-Tenant: ahmverdun
Authorization: Bearer <TAKATAK_AHMV_CONTENT_TOKEN>
```

## Supported content

The same engine can moderate:

- news;
- posts;
- photos;
- images;
- galleries/albums;
- schedules;
- arenas;
- team pages;
- website pages;
- FAQ;
- sponsors;
- future content types through reviewed schema expansion.

Recommended resource keys are stable and publisher-specific, for example:

```text
news:<slug>
post:<public-id>
media:<asset-id>
album:<slug>
arena:<slug>
team:<public-team-id>
schedule:<official-event-id>
page:<route>
```

Never key exact teams by display name alone.

## Contributor tiers and service target

TAKATAK derives the tier. The publisher may pass a shared auth user ID, but it may not claim that the user is paid.

TAKATAK checks the hockey membership itself.

| Tier | Priority | Review target |
| --- | --- | --- |
| guest | standard | 1–7 days |
| registered | standard | 1–7 days |
| paid AHMV member | member_priority | 48 hours |

Paid membership changes queue priority only. It never grants direct-write or auto-approval authority.

## Moderator

AHMV moderator email is configured by:

```text
AHMV_CONTRIBUTION_MODERATOR_EMAIL
```

The repository default currently uses the moderator address supplied for this project:

```text
OHMVVerdun.ca@gmail.com
```

Email is a notification channel, not the source of truth. If SMTP/SendGrid is unavailable, the contribution remains safely stored and the TAKATAK dashboard notification remains the authoritative queue.

Dashboard:

```text
/dashboard/contributions
```

Required workspace permission:

```text
approve_content
```

Moderator actions:

- approve and queue publication;
- reject;
- request changes;
- add a moderation note;
- explicitly confirm an authoritative source when required.

## Machine / AI review

The first safety layer is deterministic `takatak_rules_v1`.

It flags, among other things:

- unsafe/non-HTTPS URLs;
- possible secrets or sensitive fields;
- schedule changes without official evidence;
- media replacement without replacement media;
- oversized patches.

The schema stores `aiReviewStatus` and `aiReview` so a future TAKATAK AI reviewer can add richer semantic checks.

Machine review never publishes content and never replaces the human moderator.

## Official-source boundary

Schedules are authoritative data.

A schedule contribution can be submitted and reviewed, but the moderator must explicitly confirm that the correction was verified against an authoritative AHMV/league source before TAKATAK creates a publication.

Paid status, contributor points or badges never bypass this rule.

The same pattern can be extended to official scores, standings, registrations or other authoritative data.

## Reputation, points and badges

Only authenticated contributor profiles accumulate reputation. Anonymous suggestions are accepted but do not earn persistent points.

Initial approved-contribution points:

- standard content: 10;
- arena/photo/image: 12;
- verified schedule correction: 15.

Current badge thresholds:

- `new_contributor`;
- `community_helper`: 50 points + 5 approvals;
- `trusted_contributor`: 250 points + 12 published contributions;
- `community_expert`: 750 points + 35 published contributions;
- `community_champion`: 1500 points + 75 published contributions.

Points are awarded for accepted work, not raw submission volume. This prevents spam-based point farming.

## Public-content registry

AHMV can register its current safe public content in TAKATAK:

```http
POST /api/integrations/ahmv/content/sync
```

Payload:

```json
{
  "items": [
    {
      "resourceType": "arena",
      "resourceKey": "arena:auditorium-de-verdun",
      "title": "Auditorium de Verdun",
      "canonicalUrl": "https://ahmverdun.ca/arenas/auditorium-de-verdun",
      "sourceKind": "ahmv_public",
      "sourceUrl": "https://montreal.ca/lieux/auditorium-de-verdun",
      "snapshot": {
        "name": "Auditorium de Verdun"
      },
      "editableFields": ["description", "photo", "parkingNotes"],
      "version": 1
    }
  ]
}
```

Only safe public content belongs in this registry. Never sync private child, roster, billing, credential, family-contact or medical data.

## Submit contribution

```http
POST /api/integrations/ahmv/contributions
```

Example:

```json
{
  "idempotencyKey": "browser-generated-uuid",
  "resourceType": "arena",
  "resourceKey": "arena:auditorium-de-verdun",
  "action": "replace_media",
  "reason": "This is a clearer current exterior photo.",
  "proposedPatch": {
    "heroImageUrl": "https://approved-upload.example/image.jpg"
  },
  "attachmentUrls": [
    "https://approved-upload.example/image.jpg"
  ],
  "evidenceUrls": [
    "https://montreal.ca/lieux/auditorium-de-verdun"
  ],
  "contributorAuthUserId": "<shared-auth-user-id>"
}
```

TAKATAK determines whether that identity has paid hockey access.

The response includes:

- contribution ID;
- duplicate/idempotency state;
- priority;
- SLA;
- review due time;
- machine screening state;
- moderator email delivery state.

## Contributor account surface

AHMV can retrieve the badge, points and recent contribution state server-to-server:

```http
GET /api/integrations/ahmv/contributors/reputation?authUserId=<uuid>
```

A contribution can be checked by ID:

```http
GET /api/integrations/ahmv/contributions/<id>
```

These endpoints are server-to-server. A browser must not receive the TAKATAK content token.

## Publication delivery

Approved changes are delivered as versioned overlays:

```http
GET /api/integrations/ahmv/content/overlays
```

AHMV applies only fields it explicitly supports for that resource type.

After application:

```http
POST /api/integrations/ahmv/content/publications/<publicationId>/ack
```

with:

```json
{
  "applied": true,
  "snapshot": {
    "...": "new safe public snapshot"
  }
}
```

A failed apply is acknowledged with `applied: false`; TAKATAK retains the audit record.

## Why overlays instead of editing Git

This avoids turning every community correction into:

```text
parent → ChatGPT → code patch → CI → production deploy
```

Instead:

```text
parent → TAKATAK moderation → approved overlay → AHMV
```

Git remains responsible for application code and static baseline content. Community-approved public corrections become data.

This reduces deployment risk and makes the same engine reusable by future TAKATAK-managed sites.

## Future AHMV UI contract

AHMV can now add a small contribution affordance to:

- news cards/articles;
- images;
- gallery assets;
- arena pages;
- team pages;
- schedules;
- other managed public content.

Suggested labels:

- Suggest a correction
- Replace / update photo
- Report outdated information
- Improve this arena page

For paid members, the UI may display the 48-hour moderation target. It must not say that paid edits are automatically accepted.

## Future expansion

The backend is intentionally generic enough to later support:

- contributor leaderboards;
- domain-specific badges;
- trusted contributor scopes;
- AI semantic source comparison;
- duplicate suggestion clustering;
- image quality/safety checks;
- moderation assignment;
- escalation;
- multi-moderator review;
- website-specific editorial policies;
- TAKATAK Creative Studio integration.

External editing products are not part of this foundation. TAKATAK owns the workflow and can integrate creative tools later without making them the authority.
