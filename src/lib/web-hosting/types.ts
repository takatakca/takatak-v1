// Phase 7 — Web/hosting view types (serializable, UI-facing).
export type DataSource = "database" | "mock" | "unavailable";

export interface SourceMeta {
  source: DataSource;
  sourceLabel: string;
}

export interface DomainSummary {
  id: string;
  domainName: string;
  brandName: string | null;
  brandWebsite: string | null;
  brandCategory: string | null;
  brandTimezone: string | null;
  brandImageUrl: string | null;
  registrar: string | null;
  status: string;
  dnsStatus: string;
  sslStatus: string;
  autoRenew: boolean;
  expiresAt: string | null;
  createdAt: string | null;
}

export interface HostingServiceSummary {
  id: string;
  planName: string;
  brandName: string | null;
  primaryDomain: string | null;
  status: string;
  serverStatus: string;
  renewalDate: string | null;
  createdAt: string | null;
  usageSummary: Record<string, unknown> | null;
  fromUpmind: boolean;
}

export interface DnsRecordSummary {
  id: string;
  domainName: string;
  type: string;
  name: string;
  value: string;
  ttl: number | null;
  status: string;
  source: string;
}

export interface SslCertificateSummary {
  id: string;
  domainName: string;
  status: string;
  issuer: string | null;
  validFrom: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  source: string;
}

export interface ProvisioningStepSummary {
  id: string;
  groupName: string; // hosting service / brand
  type: string;
  title: string;
  status: string;
  order: number;
  plannedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface WebHostingKpis {
  domains: number;
  hostingServices: number;
  dnsWarnings: number;
  sslPending: number;
  provisioningSteps: number;
}

export interface WebHostingOverviewData extends SourceMeta {
  kpis: WebHostingKpis;
  domains: DomainSummary[];
  hostingServices: HostingServiceSummary[];
  dnsCounts: Record<string, number>;
  sslCounts: Record<string, number>;
  provisioningSteps: ProvisioningStepSummary[];
}

/** Upmind readiness — Phase 7 is always "not_connected"; the real adapter
 *  and state ladder arrive in Phase 8. */
export interface UpmindReadiness {
  provider: "upmind";
  state: "not_connected";
  message: string;
}
