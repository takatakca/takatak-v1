// Phase 8 — Upmind integration types.

export type UpmindConnectionState =
  | "not_configured"
  | "configured_untested"
  | "connected" // ONLY after a real documented API call succeeds
  | "error"
  | "disabled";

export type { UpmindEnvStatus } from "./env";

export interface UpmindTestConnectionResult {
  state: UpmindConnectionState;
  message: string;
  httpStatus?: number;
  testedAt?: string;
}

export interface UpmindProviderStatus {
  provider: "upmind";
  state: UpmindConnectionState;
  configured: boolean;
  canAttemptLiveTest: boolean;
  missing: string[];
  message: string;
}

export interface UpmindCapability {
  name: string;
  phase: string;
  available: boolean; // false throughout Phase 8
}

export interface UpmindPlannedSyncJob {
  type: "sync_domain_status" | "provision_hosting" | "retry_integration_task";
  planKind:
    | "product_sync"
    | "client_service_sync"
    | "invoice_sync"
    | "provisioning_sync"
    | "domain_status_sync";
  provider: "upmind";
  status: "planned";
  description: string;
  persisted: boolean;
  jobId?: string;
}

export type UpmindWebhookVerificationState = "not_configured" | "configured_untested" | "disabled";

export interface UpmindWebhookVerificationResult {
  state: UpmindWebhookVerificationState;
  trusted: false; // Phase 8 NEVER trusts webhook events
  message: string;
}

export interface UpmindWebhookEventSummary {
  received: boolean;
  recorded: boolean; // IntegrationEvent row created (status received/ignored)
  state: UpmindWebhookVerificationState;
}

export interface UpmindNotImplementedResult {
  implemented: false;
  message: string;
  items: never[];
}
