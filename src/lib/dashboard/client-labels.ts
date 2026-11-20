// Labels that describe how a screen was built, not what it does for the
// client: "Foundation", "Future phase", "Phase 12", "Coming soon", "Internal
// demo"... They were stamped on page headers while the dashboard was being
// built and must never reach a client (owner's order, Nov 2026: no prototypes
// in front of clients).

const BUILD_PHASE_LABELS = new Set([
  "foundation",
  "future phase",
  "coming soon",
  "planned",
  "no automation",
  "no worker active",
  "internal demo",
  "demo",
  "prototype",
  "mock data",
  "no writes",
  "view only",
  "read only",
  "read-only",
]);

/** True for a build-phase label ("Foundation", "Phase 6/7", "Mock …"). */
export function isBuildPhaseLabel(label: string): boolean {
  const value = label.trim().toLowerCase();
  if (BUILD_PHASE_LABELS.has(value)) return true;
  return /^phase\s*\d/.test(value) || value.startsWith("mock") || value.startsWith("foundation");
}

/** Header badges a client may see: build-phase labels are dropped. */
export function clientBadges<T extends string | { label: string }>(badges: readonly T[]): T[] {
  return badges.filter((badge) => !isBuildPhaseLabel(typeof badge === "string" ? badge : badge.label));
}

/** Shown under data that comes from the client's own account (replaces "Database — live foundation records …"). */
export const LIVE_DATA_LABEL = "Données à jour de votre compte · Live data from your account";
