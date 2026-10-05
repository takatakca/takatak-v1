# AHMV exact-team social feed bridge

This integration exposes a deliberately small public-feed surface from **GROUPE TAKATAK** to the AHM Verdun website.

## Ownership boundary

- **TAKATAK Dashboard** owns social OAuth, provider credentials, Social billing, brand/account permissions and synchronized provider content.
- AHM Verdun owns the public hockey presentation layer.
- AHM Verdun identifies teams only by the exact existing public AHMV team ID.
- Provider credentials, private analytics and internal tenant identifiers never cross into AHM Verdun.

## Exact team mapping

A team feed is mapped through an existing Social Media `ServiceInstance` attached to the correct `BusinessBrand`.

Its `metadata` must contain:

```json
{
  "ahmv": {
    "publicTeamId": "2025191400017305"
  }
}
```

The endpoint queries this exact JSON path at the database boundary and reads at most two matches. Zero mappings fail closed as not connected. More than one mapping fails closed as ambiguous; TAKATAK never guesses between tenants or brands.

## Endpoint

`GET /api/integrations/ahmv/team-feed?teamId=<publicTeamId>`

Required server-only headers:

```text
Authorization: Bearer <AHMV_TEAM_FEED_SHARED_TOKEN>
X-AHMV-Team-ID: <same exact publicTeamId>
```

The query ID and header ID must match.

## Production settings

TAKATAK:

```text
AHMV_TEAM_FEED_ENABLED=true
AHMV_TEAM_FEED_SHARED_TOKEN=<dedicated random server secret, 24+ characters>
```

AHM Verdun server:

```text
TAKATAK_TEAM_FEED_ENABLED=true
TAKATAK_TEAM_FEED_ORIGIN=https://takatak.ca
TAKATAK_TEAM_FEED_TOKEN=<same dedicated server secret>
```

AHM Verdun browser display flag:

```text
VITE_TAKATAK_TEAM_FEED_ENABLED=true
```

Keep every flag disabled until mappings and the shared token have been verified.

## Access rules

Public content is returned only when all of these are true:

1. the bridge feature flag is enabled;
2. the dedicated bearer token is valid;
3. query/header exact team IDs match;
4. the team maps to exactly one Social Media service;
5. the service is active;
6. its BusinessBrand is active;
7. the existing Social subscription lifecycle reports paid access;
8. at least one supported social account is connected and available.

Supported public platforms are Facebook, Instagram, TikTok, X and YouTube.

## Public output

Only synchronized `SocialContentItem` rows marked `available` are considered, newest first, maximum 20.

The response exposes only:

- opaque content hash as item ID;
- platform;
- publication timestamp;
- caption excerpt (maximum 1200 characters);
- HTTPS permalink;
- optional HTTPS thumbnail.

URLs with embedded credentials or non-HTTPS protocols are rejected.

The endpoint never selects or returns provider object IDs, OAuth tokens, refresh tokens, tenant identifiers or private analytics.

## Status behavior

- disabled integration: HTTP 503;
- missing/invalid bearer token: HTTP 401;
- invalid exact team ID: HTTP 404;
- query/header mismatch: HTTP 400;
- no mapping / no connected account: HTTP 404;
- blocked or missing Social subscription: HTTP 402;
- inactive brand/service: HTTP 404;
- duplicate team mapping: HTTP 409;
- active/connected feed: HTTP 200.

All responses use `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`.

## Release verification

Run:

```text
npm run qa:ahmv-team-feed
npm run qa:hockey-readiness
```

The team feed safeguard is also chained into the AHMV hockey CI suite.

Before enabling production, test one exact mapped team, one unmapped team, one duplicate mapping scenario and one expired/blocked Social subscription.
