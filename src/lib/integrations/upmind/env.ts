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

/**
 * Accepts the current name UPMIND_API_KEY and the former-project name UPMIND_KEY.
 * Never log or return this value.
 */
export function getUpmindApiKey(): string {
  return (
    process.env.UPMIND_API_KEY?.trim() ||
    process.env.UPMIND_KEY?.trim() ||
    ""
  );
}

export function getUpmindApiBaseUrl(): string {
  return process.env.UPMIND_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
}

export function getUpmindBrandId(): string {
  return (
    process.env.UPMIND_BRAND_ID?.trim() ||
    process.env.NEXT_PUBLIC_UPMIND_BRAND_ID?.trim() ||
    ""
  );
}

/** Webhook HMAC secret. Never log or return this from status APIs. */
export function getUpmindWebhookSecret(): string {
  return process.env.UPMIND_WEBHOOK_SECRET?.trim() ?? "";
}

export function getUpmindEnvStatus(): UpmindEnvStatus {
  const missing: string[] = [];
  if (!getUpmindApiKey()) missing.push("UPMIND_API_KEY");
  if (!getUpmindApiBaseUrl()) missing.push("UPMIND_API_BASE_URL");
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
