# AHMV exact-team social feed bridge

This integration exposes a deliberately small public-feed surface from GROUPE TAKATAK to AHM Verdun.

## Authority

- GROUPE TAKATAK owns social OAuth, provider tokens, Social billing, brand/account permissions and synchronized provider content.
- AHM Verdun owns the public hockey presentation layer and identifies each public team by its existing AHMV team ID.
- Provider credentials never cross into AHMV.
- AHMV never reads one TAKATAK client/brand by name or guesswork.

## Team mapping

Each team that should expose a feed must have an existing Social Media `ServiceInstance` tied to the correct `BusinessBrand`.

Its `metadata` must contain:

```json
{
  "ahmv": {
    "publicTeamId": "2025191400017305"
  }
}
```

The public team ID must be unique across AHMV-mapped service instances.

No migration is required. The existing `ServiceInstance.metadata` field is the binding authority.

## Feed endpoint

`GET /api/integrations/ahmv/team-feed?teamId=<publicTeamId>`

Server-only header:

`Authorization: Bearer <AHMV_TEAM_FEED_SHARED_TOKEN>`

The shared token must be at least 24 characters and must be provisioned independently in both applications:

- TAKATAK: `AHMV_TEAM_FEED_SHARED_TOKEN`
- AHM Verdun: `TAKATAK_TEAM_FEED_TOKEN`

AHM Verdun also needs:

- `TAKATAK_TEAM_FEED_ENABLED=true`
- `TAKATAK_TEAM_FEED_ORIGIN=https://takatak.ca`
- browser display flag `VITE_TAKATAK_TEAM_FEED_ENABLED=true`

Keep every flag off until the mapping and shared secret are deployed.

## Access rules

The endpoint returns content only when all of these conditions are true:

1. the AHMV team ID maps to exactly one Social Media service;
2. the service is active;
3. its BusinessBrand is active;
4. the client Social subscription has paid access according to the existing subscription lifecycle;
5. at least one supported social account for that brand is connected and available.

Supported public platforms are Facebook, Instagram, TikTok, X and YouTube.

## Public output

The endpoint reads only synchronized `SocialContentItem` rows marked `available`, newest first, maximum 20.

It exposes only:

- opaque content hash as item ID;
- platform;
- publication timestamp;
- caption excerpt;
- HTTPS permalink;
- optional HTTPS thumbnail.

Provider object IDs, access tokens, internal tenant identifiers and private analytics are never returned.

## Status behavior

- no mapping / no connected account: HTTP 404 → AHMV renders `not_connected`;
- blocked or missing Social subscription: HTTP 402 → AHMV renders `subscription_required`;
- inactive brand/service: HTTP 404;
- ambiguous duplicate mapping: HTTP 409;
- active feed: HTTP 200.

All responses use `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`.

## Subscription models

Both operating models are supported:

- one TAKATAK Client per hockey team, allowing independent billing per team;
- one organization Client with multiple BusinessBrands, using the existing Social brand allowance.

The AHMV public team ID always maps to the BusinessBrand through its Social Media ServiceInstance, so the public site does not care which commercial model is used.

## Release safety

Run:

`npm run verify:ahmv-team-feed`

The command is also part of TAKATAK CI.
