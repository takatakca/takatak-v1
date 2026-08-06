// Phase 8 — Safe low-level Upmind client.
// NO guessed endpoints: a live request happens ONLY when the admin provided
// UPMIND_API_BASE_URL + UPMIND_TEST_ENDPOINT from confirmed official docs.
// Secrets never appear in return values, logs, or errors.
import "server-only";
import { getUpmindEnvStatus } from "./env";
import type { UpmindTestConnectionResult } from "./types";

const TIMEOUT_MS = 8000;

function redact(text: string): string {
  const key = process.env.UPMIND_API_KEY;
  const secret = process.env.UPMIND_WEBHOOK_SECRET;
  let out = text;
  if (key) out = out.split(key).join("[REDACTED_KEY]");
  if (secret) out = out.split(secret).join("[REDACTED_SECRET]");
  return out;
}

/**
 * Attempts ONE live test request iff the full live-test env is present.
 * Auth is sent as "Authorization: Bearer <key>"; adjust in this single spot
 * once the official Upmind auth mechanism is confirmed from documentation.
 */
export async function attemptUpmindTestRequest(): Promise<UpmindTestConnectionResult> {
  const env = getUpmindEnvStatus();
  if (!env.configured) {
    return { state: "not_configured", message: `Upmind credentials are not configured. Missing: ${env.missing.join(", ")}.` };
  }
  if (!env.canAttemptLiveTest) {
    return {
      state: "configured_untested",
      message:
        "Credentials detected, but no confirmed live test endpoint is configured (UPMIND_TEST_ENDPOINT). No request was attempted — endpoints are never guessed.",
    };
  }

  const base = process.env.UPMIND_API_BASE_URL!.replace(/\/+$/, "");
  const endpoint = process.env.UPMIND_TEST_ENDPOINT!.replace(/^\/+/, "");
  const url = `${base}/${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.UPMIND_API_KEY!}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.ok) {
      return { state: "connected", message: "Live Upmind API test succeeded.", httpStatus: response.status, testedAt: new Date().toISOString() };
    }
    return {
      state: "error",
      message: `Live Upmind API test failed with HTTP ${response.status}. Verify the endpoint and credentials.`,
      httpStatus: response.status,
      testedAt: new Date().toISOString(),
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "unknown error";
    return { state: "error", message: `Live Upmind API test failed safely: ${redact(raw).slice(0, 200)}`, testedAt: new Date().toISOString() };
  } finally {
    clearTimeout(timer);
  }
}
