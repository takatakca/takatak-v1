// Phase 6 — Safe low-level Metricool client.
//
// CRITICAL RULES:
// - NO guessed endpoints. A live request happens ONLY when the admin has
//   explicitly provided METRICOOL_API_BASE_URL and METRICOOL_TEST_ENDPOINT
//   from confirmed official documentation or account settings.
// - Secrets never appear in return values, logs, or error messages.
// - Raw provider errors never reach the UI.
import "server-only";
import { getMetricoolEnvStatus } from "./env";
import type { MetricoolTestConnectionResult } from "./types";

const TIMEOUT_MS = 8000;

function redact(text: string): string {
  const key = process.env.METRICOOL_API_KEY;
  const account = process.env.METRICOOL_ACCOUNT_ID;
  let out = text;
  if (key) out = out.split(key).join("[REDACTED_KEY]");
  if (account) out = out.split(account).join("[REDACTED_ACCOUNT]");
  return out;
}

/**
 * Attempts ONE live test request iff the full live-test env is present.
 * Auth is sent via the X-Mc-Auth header; if the confirmed endpoint uses a
 * different mechanism (e.g. query token), the admin can embed it in the
 * configured URL. Adjust here once official docs are confirmed.
 */
export async function attemptMetricoolTestRequest(): Promise<MetricoolTestConnectionResult> {
  const env = getMetricoolEnvStatus();
  if (!env.configured) {
    return { state: "not_configured", message: `Metricool credentials are not configured. Missing: ${env.missing.join(", ")}.` };
  }
  if (!env.canAttemptLiveTest) {
    return {
      state: "configured_untested",
      message:
        "Credentials detected, but no confirmed live API endpoint is configured (METRICOOL_API_BASE_URL / METRICOOL_TEST_ENDPOINT). No request was attempted — endpoints are never guessed.",
    };
  }

  const base = process.env.METRICOOL_API_BASE_URL!.replace(/\/+$/, "");
  const endpoint = process.env.METRICOOL_TEST_ENDPOINT!.replace(/^\/+/, "");
  const url = `${base}/${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Mc-Auth": process.env.METRICOOL_API_KEY!,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.ok) {
      return {
        state: "connected",
        message: "Live Metricool API test succeeded.",
        httpStatus: response.status,
        testedAt: new Date().toISOString(),
      };
    }
    return {
      state: "error",
      message: `Live Metricool API test failed with HTTP ${response.status}. Verify the endpoint and credentials.`,
      httpStatus: response.status,
      testedAt: new Date().toISOString(),
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "unknown error";
    return {
      state: "error",
      message: `Live Metricool API test failed safely: ${redact(raw).slice(0, 200)}`,
      testedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}
