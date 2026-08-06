// Phase 13 — Admin control tower view types (serializable, UI-facing).
export type AdminDataSource = "database" | "mock" | "unavailable";

export interface SourceMeta {
  source: AdminDataSource;
  sourceLabel: string;
}

export interface AdminClientSummary {
  id: string;
  name: string;
  status: string;
  brandCount: number;
  serviceCount: number;
  memberCount: number;
  createdAt: string;
}

export interface TeamMemberSummary {
  id: string;
  profileId: string;
  clientId: string;
  displayName: string | null;
  email: string | null;
  role: string;
  profileStatus: string;
  membershipStatus: string;
  clientName: string;
  createdAt: string;
}

export interface AdminUserMembershipSummary {
  id: string;
  clientId: string;
  clientName: string;
  role: string;
  status: string;
}

export interface AdminUserSummary {
  id: string;
  authUserId: string;
  displayName: string | null;
  email: string;
  platformRole: string;
  profileStatus: string;
  memberships: AdminUserMembershipSummary[];
  workspaceCount: number;
  ownerWorkspaceCount: number;
  createdAt: string;
}

export interface JobMonitorSummary {
  id: string;
  type: string;
  provider: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  clientName: string | null;
  scheduledFor: string | null;
  errorMessage: string | null;
  createdAt: string;
  logs: { id: string; level: string; message: string; createdAt: string }[];
}

export interface IntegrationEventSummary {
  id: string;
  provider: string;
  eventType: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface AuditLogSummary {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorName: string | null;
  clientName: string | null;
  note: string | null;
  createdAt: string;
}

export interface AdminNotificationSummary {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  clientName: string | null;
  createdAt: string;
}

export interface AdminServiceSummary {
  id: string;
  name: string;
  serviceType: string;
  provider: string | null;
  status: string;
  clientName: string;
  brandName: string | null;
  priceCents: number | null;
  currency: string;
  renewalDate: string | null;
}

export interface AdminSystemHealthItem {
  label: string;
  value: string;
  ok: boolean | null;
}

export interface AdminOpsKpis {
  clients: number;
  teamMembers: number;
  jobs: number;
  plannedJobs: number;
  runningJobs: number; // 0 — no workers exist
  integrationEvents: number;
  auditEntries: number;
  unreadNotifications: number;
}

export interface AdminOverviewData extends SourceMeta {
  kpis: AdminOpsKpis;
  jobStatusCounts: { status: string; count: number }[];
  recentAudit: AuditLogSummary[];
  recentEvents: IntegrationEventSummary[];
  notifications: AdminNotificationSummary[];
}
