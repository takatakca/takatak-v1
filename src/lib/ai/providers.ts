// Phase 9 — AI provider readiness checks. Presence metadata only.
// NO API calls to OpenAI or TryHolo exist anywhere in this phase.
// "connected" is reserved for future phases after a real tested call.

import type { AiProviderStatus } from "./types";

export function getOpenAiStatus(): AiProviderStatus {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  return {
    provider: "openai",
    state: configured ? "configured_untested" : "not_configured",
    configured,
    enabled: true,
    missing: configured ? [] : ["OPENAI_API_KEY"],
    message: configured
      ? "OpenAI key detected — no call has been made and no connection is verified."
      : "OpenAI is not configured (OPENAI_API_KEY missing).",
  };
}

export function getTryHoloStatus(): AiProviderStatus {
  const enabled = process.env.TRYHOLO_ENABLED === "true";
  const hasKey = Boolean(process.env.TRYHOLO_API_KEY);
  if (!enabled) {
    return {
      provider: "tryholo",
      state: "disabled",
      configured: hasKey,
      enabled: false,
      missing: hasKey ? [] : ["TRYHOLO_API_KEY"],
      message: "TryHolo is disabled (TRYHOLO_ENABLED is not true). The platform never depends on it.",
    };
  }
  if (!hasKey) {
    return {
      provider: "tryholo",
      state: "not_configured",
      configured: false,
      enabled: true,
      missing: ["TRYHOLO_API_KEY"],
      message: "TryHolo is enabled but not configured (TRYHOLO_API_KEY missing).",
    };
  }
  return {
    provider: "tryholo",
    state: "configured_untested",
    configured: true,
    enabled: true,
    missing: [],
    message: "TryHolo key detected — no call has been made and no connection is verified. Endpoints are never guessed.",
  };
}

export function getAiProviderStatuses(): AiProviderStatus[] {
  return [getOpenAiStatus(), getTryHoloStatus()];
}
