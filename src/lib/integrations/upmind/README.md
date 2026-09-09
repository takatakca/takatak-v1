# Upmind Adapter (Phase 8 — foundation, NOT connected)

Structure mirrors the Metricool adapter:
- `env.ts` — presence checks only; secrets never returned or logged.
- `client.ts` — the ONLY place that performs a live HTTP request, and only
  when UPMIND_API_KEY + UPMIND_API_BASE_URL + UPMIND_TEST_ENDPOINT all exist.
  Timeout + abort, secrets redacted from errors.
- `adapter.ts` — getProviderStatus, testConnection, listProducts /
  listClientServices ("not implemented until endpoint confirmed"), and
  plan-only sync methods.
- `upmind-jobs.ts` — planned job payloads/records only; nothing runs,
  provisions, registers, or syncs; nothing is marked completed.
- `upmind-service.ts` — DB-aware readiness; persists real test results
  (configured_untested → pending_credentials at the IntegrationAccount level).
- `webhook.ts` — HMAC-SHA256 verification of `X-Webhook-Signature` against the
  raw body (official Upmind consuming-webhooks docs). Disabled / missing secret /
  bad signature never apply domain rows.
- `webhook-payload.ts` — parses V1 envelopes and extracts domain + Upmind client id.
- `webhook-apply.ts` — idempotent DomainAsset upsert onto the TAKATAK workspace
  linked by `Profile.upmindClientId`.

Credential rules: env vars only, server-side. Base URL and test endpoint stay
EMPTY until confirmed from official documentation — endpoints are never
guessed and connections are never simulated.

States: not_configured → configured_untested → connected / error / disabled.
"connected" requires a real documented API call succeeding with real
credentials.

DNS editing, SSL installation, and hosting provisioning are not active.
Paid domain webhook events can create or update DomainAsset rows.
