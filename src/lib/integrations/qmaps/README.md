# QMAPS → TAKATAK listings and reviews sync

QMAPS (`takatakca/qmaps`) is the source of truth for its businesses and
reviews. It sends signed events to TAKATAK; TAKATAK updates the linked
client workspace's local listing and reviews (`/dashboard/local-listings`,
`/dashboard/local-listings/reviews`). This path only receives; links and
review replies go to QMAPS from Admin › QMAPS and the reply form (#171).

Full contract: `docs/QMAPS_LISTINGS_REVIEWS_SYNC.md`.

- `signature.ts` — HMAC-SHA256 over `${timestamp}.${eventId}.${rawBody}`,
  dedicated QMAPS credential, 5-minute clock window.
- `parser.ts` — strict v1 whitelist; rejects credentials and reviewer identity.
- `apply-event.ts` — idempotent per event id; only businesses linked to exactly
  one workspace (LocalListing provider `qmaps`, `metadata.qmapsBusinessId`,
  set in Admin › QMAPS) are applied; others are logged as `UNLINKED`.
- Route: `POST /api/integrations/qmaps/events`.
- Link a business: Admin › QMAPS (`/dashboard/admin/qmaps`).
