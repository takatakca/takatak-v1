// Phase 6 — Metricool integration types.

export type MetricoolConnectionState =
  | "not_configured" // required env vars missing
  | "configured_untested" // env vars exist; no confirmed live API test succeeded
  | "connected" // a REAL documented API call succeeded with real credentials
  | "error" // a real test was attempted and failed safely
  | "disabled"; // provider intentionally disabled

export type { MetricoolEnvStatus } from "./env";

export interface MetricoolTestConnectionResult {
  state: MetricoolConnectionState;
  message: string;
  httpStatus?: number; // present only when a real request was attempted
  testedAt?: string;
}

export interface MetricoolProviderStatus {
  provider: "metricool";
  state: MetricoolConnectionState;
  configured: boolean;
  canAttemptLiveTest: boolean;
  missing: string[];
  message: string;
}

export interface MetricoolAccountSummary {
  implemented: false; // flips only when the official endpoint is confirmed
  message: string;
  accounts: never[];
}

export interface MetricoolPlannedSyncJob {
  type: "sync_analytics" | "send_to_metricool";
  provider: "metricool";
  status: "planned";
  description: string;
  persisted: boolean; // true only when a DB Job record was created
  jobId?: string;
}

export interface MetricoolSyncCapability {
  name: string;
  phase: string;
  available: boolean; // false throughout Phase 6
}
