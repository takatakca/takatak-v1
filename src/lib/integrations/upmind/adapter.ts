// Phase 8 — Upmind provider adapter (the ONLY web/hosting-engine boundary).
// Honest by construction: "connected" can only come from a real test result.
import "server-only";
import { attemptUpmindTestRequest } from "./client";
import { getUpmindEnvStatus } from "./env";
import {
  createUpmindClientServiceSyncPlan,
  createUpmindDomainStatusSyncPlan,
  createUpmindInvoiceSyncPlan,
  createUpmindProductSyncPlan,
  createUpmindProvisioningPlan,
} from "./upmind-jobs";
import type {
  UpmindNotImplementedResult,
  UpmindPlannedSyncJob,
  UpmindProviderStatus,
  UpmindTestConnectionResult,
} from "./types";

export function getProviderStatus(): UpmindProviderStatus {
  const env = getUpmindEnvStatus();
  if (!env.configured) {
    return {
      provider: "upmind",
      state: "not_configured",
      configured: false,
      canAttemptLiveTest: false,
      missing: env.missing,
      message: "Upmind credentials are not configured.",
    };
  }
  return {
    provider: "upmind",
    state: "configured_untested",
    configured: true,
    canAttemptLiveTest: env.canAttemptLiveTest,
    missing: [],
    message: env.canAttemptLiveTest
      ? "Credentials and live test endpoint detected. Run a test connection to verify."
      : "Credentials detected, live API test endpoint not confirmed.",
  };
}

export async function testConnection(): Promise<UpmindTestConnectionResult> {
  return attemptUpmindTestRequest();
}

const NOT_IMPLEMENTED = (what: string): UpmindNotImplementedResult => ({
  implemented: false,
  message: `${what} is not implemented until the official Upmind endpoint is confirmed and a real credentialed call succeeds.`,
  items: [],
});

export function listProducts(): UpmindNotImplementedResult {
  return NOT_IMPLEMENTED("Product catalogue listing");
}

export function listClientServices(): UpmindNotImplementedResult {
  return NOT_IMPLEMENTED("Client service listing");
}

export const planProductSync = (o?: { persist?: boolean }): Promise<UpmindPlannedSyncJob> => createUpmindProductSyncPlan(o);
export const planClientServiceSync = (o?: { persist?: boolean }): Promise<UpmindPlannedSyncJob> => createUpmindClientServiceSyncPlan(o);
export const planInvoiceSync = (o?: { persist?: boolean }): Promise<UpmindPlannedSyncJob> => createUpmindInvoiceSyncPlan(o);
export const planProvisioningSync = (o?: { persist?: boolean }): Promise<UpmindPlannedSyncJob> => createUpmindProvisioningPlan(o);
export const planDomainStatusSync = (o?: { persist?: boolean }): Promise<UpmindPlannedSyncJob> => createUpmindDomainStatusSyncPlan(o);
