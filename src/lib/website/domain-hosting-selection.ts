/**
 * Short-lived, public-flow-only selection state that keeps the domain and
 * hosting journeys coherent (domain → hosting cross-sell and back).
 *
 * This is NOT a session or auth system: it is session-storage scoped, holds
 * no personal data and is cleared by the browser when the tab closes. The
 * existing `domainSearchState` remains the source of truth for the domain
 * query itself; this module only records what the visitor picked next.
 */

const KEY = "takatak:domain-hosting-selection";

export type DomainOwnership = "has" | "needs" | "later";

export interface DomainHostingSelection {
  /** Domain candidate the visitor selected — a request, not a registration. */
  selectedDomain?: string;
  /** Hosting plan key from `pricing.hosting`. */
  hostingPlan?: string;
  /** Answer to "do you already have a domain?". */
  ownership?: DomainOwnership;
  at: string;
}

export function readSelection(): DomainHostingSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DomainHostingSelection) : null;
  } catch {
    return null;
  }
}

export function writeSelection(patch: Partial<Omit<DomainHostingSelection, "at">>): DomainHostingSelection {
  const next: DomainHostingSelection = {
    ...(readSelection() ?? {}),
    ...patch,
    at: new Date().toISOString(),
  };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage may be unavailable */
  }
  return next;
}

export function clearSelection(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Recommended hosting plan for a visitor who only has a domain so far. */
export const RECOMMENDED_HOSTING_PLAN = "bronze";