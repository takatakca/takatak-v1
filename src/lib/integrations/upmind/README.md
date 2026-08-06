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
  (configured_untested → pending_credentials at the DB level).
- `webhook.ts` — verification SKELETON. Events are NEVER trusted in Phase 8:
  disabled → "disabled"; secret missing → "not_configured"; secret present →
  "configured_untested" because the official signature scheme (header +
  algorithm) must be confirmed from Upmind docs first. There is no fake
  "valid" rule.

Credential rules: env vars only, server-side. Base URL and test endpoint stay
EMPTY until confirmed from official documentation — endpoints are never
guessed and connections are never simulated.

States: not_configured → configured_untested → connected / error / disabled.
"connected" requires a real documented API call succeeding with real
credentials.

Phase 8 performs NO domain registration, DNS editing, SSL installation,
invoice sync, product sync, or hosting provisioning.
