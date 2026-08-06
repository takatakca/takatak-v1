// Phase 6 — Metricool provider adapter (the ONLY social-engine boundary).
// Honest by construction: "connected" can only come from a real test result.
import "server-only";
import { attemptMetricoolTestRequest } from "./client";
import { getMetricoolEnvStatus } from "./env";
import type {
  MetricoolAccountSummary,
  MetricoolPlannedSyncJob,
  MetricoolProviderStatus,
  MetricoolTestConnectionResult,
} from "./types";
import { createMetricoolSendApprovedPostsPlan, createMetricoolSyncAnalyticsPlan } from "./metricool-jobs";

export function getProviderStatus(): MetricoolProviderStatus {
  const env = getMetricoolEnvStatus();
  if (!env.configured) {
    return {
      provider: "metricool",
      state: "not_configured",
      configured: false,
      canAttemptLiveTest: false,
      missing: env.missing,
      message: "Metricool credentials are not configured.",
    };
  }
  return {
    provider: "metricool",
    state: "configured_untested",
    configured: true,
    canAttemptLiveTest: env.canAttemptLiveTest,
    missing: [],
    message: env.canAttemptLiveTest
      ? "Credentials and live test endpoint detected. Run a test connection to verify."
      : "Credentials detected, live API test endpoint not confirmed.",
  };
}

export async function testConnection(): Promise<MetricoolTestConnectionResult> {
  return attemptMetricoolTestRequest();
}

export function listAccounts(): MetricoolAccountSummary {
  return {
    implemented: false,
    message:
      "Account listing is not implemented until the official Metricool endpoint is confirmed and a real credentialed call succeeds.",
    accounts: [],
  };
}

export async function planSyncAnalytics(options?: { persist?: boolean }): Promise<MetricoolPlannedSyncJob> {
  return createMetricoolSyncAnalyticsPlan(options);
}

export async function planSendApprovedPosts(options?: { persist?: boolean }): Promise<MetricoolPlannedSyncJob> {
  return createMetricoolSendApprovedPostsPlan(options);
}
