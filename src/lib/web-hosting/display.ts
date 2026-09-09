import { DOMAIN_STATUS_LABELS, DNS_STATUS_LABELS, HOSTING_STATUS_LABELS, WEB_SOURCE_LABELS } from "./status";
import type { DomainSummary, HostingServiceSummary, SslCertificateSummary } from "./types";

export function daysLeft(expiresAt: string | null): string {
  if (!expiresAt) return "—";
  const expiry = new Date(`${expiresAt}T00:00:00Z`);
  const diff = Math.round((expiry.getTime() - Date.now()) / 86_400_000);
  if (Number.isNaN(diff)) return "—";
  if (diff < 0) return "Expired";
  return `${diff} days left`;
}

export function isExpiringSoon(domain: DomainSummary): boolean {
  if (domain.status === "expiring_soon") return true;
  if (!domain.expiresAt) return false;
  const expiry = new Date(`${domain.expiresAt}T00:00:00Z`);
  const diff = (expiry.getTime() - Date.now()) / 86_400_000;
  return !Number.isNaN(diff) && diff >= 0 && diff <= 30;
}

export function displayDomainStatus(status: string): {
  label: string;
  className: string;
  tone: "success" | "warning" | "muted" | "danger";
} {
  if (status === "tracked" || status === "active_internal") {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700", tone: "success" };
  }
  if (status === "expiring_soon") {
    return { label: "Expiring soon", className: "bg-amber-50 text-amber-700", tone: "warning" };
  }
  if (status === "expired") {
    return { label: "Expired", className: "bg-rose-50 text-rose-700", tone: "danger" };
  }
  if (status === "pending_connection") {
    return {
      label: DOMAIN_STATUS_LABELS[status],
      className: "bg-amber-50 text-amber-700",
      tone: "warning",
    };
  }
  return {
    label: DOMAIN_STATUS_LABELS[status] ?? "Not connected",
    className: "bg-slate-100 text-slate-600",
    tone: "muted",
  };
}

export function displayWebsiteStatus(
  domain: DomainSummary,
  hosting: HostingServiceSummary | undefined,
): { label: string; className: string; tone: "success" | "warning" | "muted" | "danger" } {
  if (hosting?.status === "active_internal" || domain.status === "tracked") {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700", tone: "success" };
  }
  if (domain.status === "expiring_soon") {
    return displayDomainStatus("expiring_soon");
  }
  if (hosting?.status === "pending_setup") {
    return { label: "Pending setup", className: "bg-amber-50 text-amber-700", tone: "warning" };
  }
  return displayDomainStatus(domain.status);
}

export function donutKey(status: string): "active" | "expiring" | "expired" | "not_connected" {
  if (status === "tracked" || status === "active_internal") return "active";
  if (status === "expiring_soon") return "expiring";
  if (status === "expired") return "expired";
  return "not_connected";
}

export function hostingForDomain(
  domain: DomainSummary,
  hosting: HostingServiceSummary[],
): HostingServiceSummary | undefined {
  return hosting.find((service) => service.primaryDomain === domain.domainName);
}

export function sslForDomain(
  domain: DomainSummary,
  certificates: SslCertificateSummary[],
): SslCertificateSummary | undefined {
  return certificates.find((certificate) => certificate.domainName === domain.domainName);
}

export function registrarLabel(registrar: string | null): string {
  if (!registrar) return "—";
  return WEB_SOURCE_LABELS[registrar] ?? registrar.replaceAll("_", " ");
}

export function dnsStatusLabel(status: string): { label: string; tone: "success" | "warning" | "muted" | "danger" } {
  if (status === "valid") return { label: "Healthy", tone: "success" };
  if (status === "warning" || status === "pending") {
    return { label: DNS_STATUS_LABELS[status] ?? status, tone: "warning" };
  }
  if (status === "error") return { label: DNS_STATUS_LABELS[status] ?? status, tone: "danger" };
  if (status === "not_configured") return { label: "Not found", tone: "muted" };
  return { label: DNS_STATUS_LABELS[status] ?? status, tone: "muted" };
}

export function dnsHealthPercent(domains: DomainSummary[]): number | null {
  if (!domains.length) return null;
  const valid = domains.filter((domain) => domain.dnsStatus === "valid").length;
  return Math.round((valid / domains.length) * 100);
}

export function websiteUrl(domain: DomainSummary): string {
  if (domain.brandWebsite) return domain.brandWebsite;
  return `https://${domain.domainName}`;
}

export function displayHostingStatus(status: string): {
  label: string;
  className: string;
  tone: "success" | "warning" | "muted" | "danger";
} {
  if (status === "active_internal") {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700", tone: "success" };
  }
  if (status === "pending_setup") {
    return { label: "Pending setup", className: "bg-amber-50 text-amber-700", tone: "warning" };
  }
  if (status === "failed") {
    return { label: "Failed", className: "bg-rose-50 text-rose-700", tone: "danger" };
  }
  return {
    label: HOSTING_STATUS_LABELS[status] ?? status,
    className: "bg-slate-100 text-slate-600",
    tone: "muted",
  };
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function usageNumber(usage: Record<string, unknown> | null, keys: string[]): number | null {
  if (!usage) return null;
  for (const key of keys) {
    const value = asNumber(usage[key]);
    if (value != null) return value;
  }
  return null;
}

export function usageString(usage: Record<string, unknown> | null, keys: string[]): string | null {
  if (!usage) return null;
  for (const key of keys) {
    const value = asString(usage[key]);
    if (value) return value;
  }
  return null;
}

export function usagePair(
  usage: Record<string, unknown> | null,
  usedKeys: string[],
  totalKeys: string[],
): { used: number; total: number; percent: number } | null {
  const used = usageNumber(usage, usedKeys);
  const total = usageNumber(usage, totalKeys);
  if (used == null || total == null || total <= 0) return null;
  return { used, total, percent: Math.round((used / total) * 100) };
}

export function formatDateLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function daysUntil(iso: string | null): string | null {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00Z`);
  const diff = Math.round((target.getTime() - Date.now()) / 86_400_000);
  if (Number.isNaN(diff)) return null;
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `in ${diff} days`;
}

export function websitesOnHosting(service: HostingServiceSummary, domains: DomainSummary[]): number {
  if (!service.primaryDomain) return 0;
  return domains.filter((domain) => domain.domainName === service.primaryDomain).length || 1;
}