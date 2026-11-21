import type { DataSource, DomainSummary } from "./types";

/**
 * Display-only renewal notices derived from the authenticated workspace's real
 * domain records. This is not a registrar status check, a renewal instruction,
 * a checkout, or a permission to change DNS/email/hosting.
 */
export type RenewalDomainRecord = Pick<
  DomainSummary,
  "domainName" | "expiresAt" | "autoRenew" | "status" | "registrar"
>;

export type DomainRenewalNotice = Readonly<{
  domainName: string;
  expiresAt: string;
  daysRemaining: number;
  autoRenew: boolean;
}>;

const DAY_MS = 86_400_000;
const DISPLAYABLE_STATUSES = new Set(["active", "active_internal", "tracked", "expiring_soon"]);
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDay(value: string): number | null {
  const match = ISO_DAY.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return ms;
}

/** Dates are calendar days in UTC, not milliseconds until an expiry timestamp. */
export function getDomainRenewalNotices(input: {
  source: DataSource;
  domains: readonly RenewalDomainRecord[];
  asOf?: Date;
}): DomainRenewalNotice[] {
  if (input.source !== "database") return [];
  const today = input.asOf ?? new Date();
  if (!Number.isFinite(today.getTime())) return [];
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const counts = new Map<string, number>();
  for (const domain of input.domains) {
    const key = domain.domainName.trim().toLowerCase().replace(/\.$/, "");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const notices: DomainRenewalNotice[] = [];
  for (const domain of input.domains) {
    const name = domain.domainName.trim().toLowerCase().replace(/\.$/, "");
    // A conflicting/duplicate domain record must be reconciled, not guessed.
    if ((counts.get(name) ?? 0) !== 1) continue;
    if (!/^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(name)) continue;
    if (!domain.registrar || domain.registrar === "internal_demo") continue;
    if (!DISPLAYABLE_STATUSES.has(domain.status)) continue;
    const expiryMs = domain.expiresAt ? parseIsoDay(domain.expiresAt) : null;
    if (expiryMs === null) continue;
    const daysRemaining = (expiryMs - todayMs) / DAY_MS;
    if (daysRemaining < 0 || daysRemaining > 30) continue;
    notices.push({
      domainName: name,
      expiresAt: domain.expiresAt!,
      daysRemaining,
      autoRenew: domain.autoRenew,
    });
  }

  return notices.sort((a, b) => a.daysRemaining - b.daysRemaining || a.domainName.localeCompare(b.domainName));
}
