# QMAPS → TAKATAK listings and reviews sync

QMAPS (`takatakca/qmaps`) is the source of truth for its businesses and
reviews. It sends signed events to TAKATAK; TAKATAK updates the linked
client workspace's local listing and reviews (`/dashboard/local-listings`,
`/dashboard/local-listings/reviews`). TAKATAK never calls QMAPS.

Full contract: `docs/QMAPS_LISTINGS_REVIEWS_SYNC.md`.

- `signature.ts` — HMAC-SHA256 over `${timestamp}.${eventId}.${rawBody}`,
  dedicated QMAPS credential, 5-minute clock window.
- `parser.ts` — strict v1 whitelist; rejects credentials and reviewer identity.
- `apply-event.ts` — idempotent per event id; only businesses linked to a
  workspace (LocalListing provider `qmaps`, `externalId` = QMAPS business id)
  are applied; others are logged as `UNLINKED`.
- Route: `POST /api/integrations/qmaps/events`.
- Link a business: `npm run qmaps:link -- --client <uuid> --business <uuid> --name "..."`.
