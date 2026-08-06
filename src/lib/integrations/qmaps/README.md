# QMAPS Adapter (placeholder — NOT connected)

Phase 11 prepared the INTERNAL local listings module only (models, data
layer, and pages in `src/lib/local-listings` + `src/components/local-listings`).
This folder still contains no implementation.

The real QMAPS API connection comes in a later phase, following the same
honest rules as the Metricool (Phase 6) and Upmind (Phase 8) adapters:
- Credentials from env vars only, server-side, presence-checked, never logged.
- No guessed endpoints; live requests only against confirmed documented URLs.
- State ladder: not_configured → configured_untested → connected / error /
  disabled — "connected" only after a real credentialed API call succeeds.
- No fake listing sync, citation scans, review imports, replies, photo sync,
  or visibility scores.
