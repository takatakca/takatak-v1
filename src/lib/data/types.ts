// Phase 2 — Core SaaS data models (typed mock foundation).
// These types define the internal structure that Supabase/Prisma (Phases 3–4)
// and real integrations (Phases 6+) will plug into. NO real data yet.

/** Honest, future-proof status vocabulary.
 *  "connected" exists in the type for future phases but MUST NOT be used
 *  until a real credentialed API call has succeeded. */
export type FoundationStatus =
  | "planned"
  | "foundation"
  | "mock_data"
  | "not_connected"
  | "disabled"
  | "needs_configuration"
  | "ready_for_auth"
  | "ready_for_integration"
  | "connected"; // reserved — never used in Phase 2 data

export type ClientPlan = "starter" | "growth" | "premium";

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  plan: ClientPlan;
  status: FoundationStatus;
  assignedAdmin: string;
  brandIds: string[];
  createdAt: string; // ISO date
  dataOrigin: "mock_foundation"; // every record self-declares as mock
}

export interface Brand {
  id: string;
  clientId: string;
  name: string;
  category: string;
  city: string;
  status: FoundationStatus;
  serviceInstanceIds: string[];
  locationIds: string[];
  dataOrigin: "mock_foundation";
}

export interface Location {
  id: string;
  brandId: string;
  label: string;
  address: string;
  city: string;
  country: string;
  listingStatus: FoundationStatus;
  dataOrigin: "mock_foundation";
}

export type ServiceModuleKey =
  | "social_media"
  | "web_hosting"
  | "local_listings"
  | "leads"
  | "ai_studio"
  | "reports";

export interface ServiceInstance {
  id: string;
  brandId: string;
  module: ServiceModuleKey;
  title: string;
  futureEngine?: string;
  status: FoundationStatus;
  activationPhase: string; // e.g. "Phase 6"
  dataOrigin: "mock_foundation";
}

export type IntegrationProvider =
  | "metricool"
  | "upmind"
  | "tryholo"
  | "qmaps"
  | "flexs"
  | "supabase"
  | "stripe";

export interface IntegrationConnection {
  id: string;
  provider: IntegrationProvider;
  displayName: string;
  purpose: string;
  status: FoundationStatus;
  requirement: string; // what unlocks it (credentials, phase, flag)
  activationPhase: string;
  envVars: string[]; // names only — never values
  dataOrigin: "mock_foundation";
}

export type JobTrigger = "manual" | "scheduled" | "webhook" | "workflow";

export interface AutomationJob {
  id: string;
  name: string;
  module: ServiceModuleKey | "core";
  trigger: JobTrigger;
  status: FoundationStatus; // "planned" in Phase 2 — no workers exist
  provider?: IntegrationProvider;
  activationPhase: string;
  description: string;
  dataOrigin: "mock_foundation";
}

export type ActivityKind =
  | "architecture"
  | "build"
  | "integration"
  | "documentation"
  | "verification";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  message: string;
  detail?: string;
  phase: string;
  dataOrigin: "mock_foundation";
}

export type UserRoleKey =
  | "super_admin"
  | "admin"
  | "manager"
  | "team_member"
  | "client_user";

export interface UserRole {
  key: UserRoleKey;
  label: string;
  scope: string;
  status: FoundationStatus; // ready_for_auth — roles activate in Phase 3
  permissionGroupIds: string[];
}

export interface PermissionGroup {
  id: string;
  label: string;
  description: string;
  permissions: string[];
}

/** Aggregate readiness rows for the platform (used on overview surfaces). */
export interface DashboardStatus {
  area: string;
  status: FoundationStatus;
  note: string;
}
