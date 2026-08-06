# Metricool Adapter (Phase 6 — foundation, NOT connected)

Structure:
- `env.ts` — presence checks only; never returns secret values.
- `client.ts` — the ONLY place that can perform a live HTTP request. It runs
  iff METRICOOL_API_KEY + METRICOOL_ACCOUNT_ID + METRICOOL_API_BASE_URL +
  METRICOOL_TEST_ENDPOINT all exist. Timeout + abort, secrets redacted from
  errors, raw provider errors never reach the UI.
- `adapter.ts` — provider interface: getProviderStatus, testConnection,
  listAccounts (returns "not implemented until endpoint confirmed"),
  planSyncAnalytics, planSendApprovedPosts.
- `metricool-jobs.ts` — creates PLANNED job payloads/records only. Nothing runs.
- `metricool-service.ts` — DB-aware readiness + persisting real test results.

Credential rules: all values come from env vars, server-side only. The API
base URL and test endpoint stay EMPTY until confirmed from official Metricool
documentation or account settings — endpoints are never guessed and no request
is ever simulated.

Connection states: not_configured → configured_untested → connected / error
(+ disabled). "connected" is reachable ONLY through a real documented API call
succeeding with real credentials; the DB IntegrationAccount status mirrors
this and uses pending_credentials for configured_untested.

Phase 6 does NOT publish posts, sync analytics, or import accounts.
