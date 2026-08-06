// Phase 6 — Metricool environment validation.
// Returns SAFE metadata only: presence booleans and missing names.
// Never returns or logs secret values.

export interface MetricoolEnvStatus {
  configured: boolean; // API key + account ID present
  missing: string[]; // names of missing REQUIRED vars
  hasApiBaseUrl: boolean;
  hasTestEndpoint: boolean;
  hasWhiteLabelUrl: boolean;
  canAttemptLiveTest: boolean; // configured + base URL + test endpoint
}

const REQUIRED = ["METRICOOL_API_KEY", "METRICOOL_ACCOUNT_ID"] as const;

export function getMetricoolEnvStatus(): MetricoolEnvStatus {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  const configured = missing.length === 0;
  const hasApiBaseUrl = Boolean(process.env.METRICOOL_API_BASE_URL);
  const hasTestEndpoint = Boolean(process.env.METRICOOL_TEST_ENDPOINT);
  return {
    configured,
    missing: [...missing],
    hasApiBaseUrl,
    hasTestEndpoint,
    hasWhiteLabelUrl: Boolean(process.env.METRICOOL_WHITE_LABEL_BASE_URL),
    canAttemptLiveTest: configured && hasApiBaseUrl && hasTestEndpoint,
  };
}

export function isMetricoolConfigured(): boolean {
  return getMetricoolEnvStatus().configured;
}
