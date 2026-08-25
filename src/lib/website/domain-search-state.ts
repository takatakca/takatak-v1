/**
 * TAKATAK Domain Search state helpers.
 *
 * Pure, provider-agnostic logic used by the header domain panel. The actual
 * availability/checkout capability lives behind the existing TAKATAK domain
 * layer (see UpmindDac + DomainRequestFallback); nothing here talks to a
 * provider directly, and no provider name is ever surfaced to customers.
 */
import { pricing } from "./pricing";
import { SUPPORTED_DOMAIN_TLDS, type SupportedDomainTld } from "./upmind-config";

export const DOMAIN_PRICE = pricing.domain.register.amount;
export const DOMAIN_TLDS = SUPPORTED_DOMAIN_TLDS;
export type { SupportedDomainTld };

const STORAGE_KEY = "takatak:domain-search";

export interface DomainSearchQuery {
  label: string;
  tld: SupportedDomainTld;
  domain: string;
  at: string;
}

/** Strip protocol/path/invalid characters from user input. */
export function sanitizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    ?.split(".")[0]
    ?.replace(/[^a-z0-9-]/g, "") ?? "";
}

export type DomainInputError = "empty" | "tooShort" | "invalid" | null;

export function validateLabel(raw: string): DomainInputError {
  const trimmed = raw.trim();
  if (!trimmed) return "empty";
  const label = sanitizeLabel(trimmed);
  if (!label) return "invalid";
  if (label.length < 2) return "tooShort";
  if (label.startsWith("-") || label.endsWith("-")) return "invalid";
  if (/[^a-z0-9-]/.test(trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "").split(".")[0] ?? "")) {
    return "invalid";
  }
  return null;
}

/** If the user typed a full domain, keep their TLD when it is supported. */
export function detectTld(raw: string, fallback: SupportedDomainTld): SupportedDomainTld {
  const parts = raw.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]?.split(".") ?? [];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return (DOMAIN_TLDS as readonly string[]).includes(last ?? "")
    ? (last as SupportedDomainTld)
    : fallback;
}

export interface DomainCandidate {
  domain: string;
  tld: SupportedDomainTld;
  primary: boolean;
  price: number;
}

/** Primary choice first, then the remaining supported TLDs and one variant. */
export function buildCandidates(label: string, tld: SupportedDomainTld): DomainCandidate[] {
  if (!label) return [];
  const list: DomainCandidate[] = [
    { domain: `${label}.${tld}`, tld, primary: true, price: DOMAIN_PRICE },
  ];
  for (const other of DOMAIN_TLDS) {
    if (other === tld) continue;
    list.push({ domain: `${label}.${other}`, tld: other, primary: false, price: DOMAIN_PRICE });
  }
  list.push({ domain: `get${label}.${tld}`, tld, primary: false, price: DOMAIN_PRICE });
  return list;
}

export function saveDomainQuery(q: Omit<DomainSearchQuery, "at">): DomainSearchQuery {
  const stored: DomainSearchQuery = { ...q, at: new Date().toISOString() };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* storage may be unavailable */
  }
  return stored;
}

export function readDomainQuery(): DomainSearchQuery | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DomainSearchQuery) : null;
  } catch {
    return null;
  }
}

export function clearDomainQuery(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}