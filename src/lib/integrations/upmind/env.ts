// Phase 8 — Upmind environment validation. Presence metadata only —
// secret values are never returned or logged.

export interface UpmindEnvStatus {
  configured: boolean; // API key + base URL present
  missing: string[]; // names of missing REQUIRED vars
  hasTestEndpoint: boolean;
  hasWebhookSecret: boolean;
  webhookEnabled: boolean;
  canAttemptLiveTest: boolean; // configured + test endpoint
}

const REQUIRED = ["UPMIND_API_KEY", "UPMIND_API_BASE_URL"] as const;

export function getUpmindEnvStatus(): UpmindEnvStatus {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  const configured = missing.length === 0;
  const hasTestEndpoint = Boolean(process.env.UPMIND_TEST_ENDPOINT);
  return {
    configured,
    missing: [...missing],
    hasTestEndpoint,
    hasWebhookSecret: Boolean(process.env.UPMIND_WEBHOOK_SECRET),
    webhookEnabled: process.env.UPMIND_WEBHOOK_ENABLED === "true",
    canAttemptLiveTest: configured && hasTestEndpoint,
  };
}

export function isUpmindConfigured(): boolean {
  return getUpmindEnvStatus().configured;
}
