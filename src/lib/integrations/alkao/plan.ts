/**
 * TAKATAK → ALKAO reconciliation plan (pure, no I/O).
 *
 * TAKATAK is the master of Clients, Brands and memberships. ALKAO (the TAKATAK Ticket Hub)
 * holds projections of them through the signed alkao.control.v1 contract. The sync reads
 * ALKAO's current state, compares it with the master records below, and plans events for
 * the differences only. With nothing to change, the plan is empty and nothing is sent.
 */

export type AlkaoMasterStatus = "active" | "suspended" | "archived";
export type AlkaoRole = "owner" | "admin" | "manager" | "editor" | "staff" | "viewer";

export interface TakatakClient {
  id: string;
  name: string;
  /** TAKATAK ClientStatus: prospect | active | paused | archived. */
  status: string;
  timezone: string;
  brands: { id: string; name: string; /** BrandStatus */ status: string }[];
  members: { authUserId: string; role: string; /** MembershipStatus */ status: string; /** ProfileStatus */ profileStatus: string }[];
}

export interface AlkaoState {
  clientId: string;
  name: string;
  status: string;
  timezone: string;
  commission: { rateBps: number; fixedCentsPerPaidAdmission: number };
  version: number;
  brands: {
    brandId: string;
    name: string;
    status: string;
    version: number;
    entitlement: { status: string; validFrom: string | null; validUntil: string | null; version: number } | null;
  }[];
  members: { userId: string; role: string; status: string; version: number }[];
}

export interface AlkaoSyncSettings {
  /** Clients synchronized to ALKAO (ALKAO_TICKETING_CLIENT_IDS). */
  clientIds: ReadonlySet<string>;
  /** Brands whose Ticketing is active in ALKAO (ALKAO_TICKETING_BRAND_IDS). */
  ticketingBrandIds: ReadonlySet<string>;
  /** Commission for a Client ALKAO does not know yet; existing Clients keep theirs. */
  defaultCommission: { rateBps: number; fixedCentsPerPaidAdmission: number } | null;
}

export interface PlannedEvent {
  type: "client.upserted" | "brand.upserted" | "membership.upserted" | "membership.removed" | "entitlement.updated";
  label: string;
  data: Record<string, unknown>;
}

export interface SyncPlan {
  events: PlannedEvent[];
  warnings: string[];
}

const ROLES: readonly AlkaoRole[] = ["owner", "admin", "manager", "editor", "staff", "viewer"];

export function clientStatus(status: string): AlkaoMasterStatus {
  if (status === "active") return "active";
  if (status === "archived") return "archived";
  return "suspended"; // prospect, paused: no sales
}

export function brandStatus(status: string): AlkaoMasterStatus {
  if (status === "active") return "active";
  if (status === "archived") return "archived";
  return "suspended"; // draft, paused, frozen
}

/**
 * Events for the differences between TAKATAK and ALKAO, in dependency order: Clients,
 * Brands, members, then Ticketing. `version` is the sync time (ms), above anything ALKAO holds.
 */
export function planAlkaoSync(master: TakatakClient[], alkao: AlkaoState[], settings: AlkaoSyncSettings, nowMs: number): SyncPlan {
  const events: PlannedEvent[] = [];
  const warnings: string[] = [];
  const byId = new Map(alkao.map((c) => [c.clientId, c]));
  const next = (stored: number | undefined) => Math.max(nowMs, (stored ?? 0) + 1);

  for (const c of master) {
    if (!settings.clientIds.has(c.id)) continue;
    const held = byId.get(c.id);
    const commission = held?.commission ?? settings.defaultCommission;
    if (!commission) {
      warnings.push(`${c.name}: not in ALKAO yet and no default commission (ALKAO_COMMISSION_RATE_BPS / ALKAO_COMMISSION_FIXED_CENTS); skipped`);
      continue;
    }
    const status = clientStatus(c.status);
    if (!held || held.name !== c.name || held.status !== status || held.timezone !== c.timezone) {
      events.push({
        type: "client.upserted",
        label: `client ${c.name}`,
        data: { clientId: c.id, name: c.name, status, timezone: c.timezone, commission, version: next(held?.version) },
      });
    }

    const brandEvents: PlannedEvent[] = [];
    const entitlementEvents: PlannedEvent[] = [];
    for (const b of c.brands) {
      const heldBrand = held?.brands.find((x) => x.brandId === b.id);
      const wantTicketing = settings.ticketingBrandIds.has(b.id);
      if (!heldBrand && !wantTicketing) continue; // ALKAO only needs the Brands that sell
      const bStatus = brandStatus(b.status);
      if (!heldBrand || heldBrand.name !== b.name || heldBrand.status !== bStatus) {
        brandEvents.push({
          type: "brand.upserted",
          label: `brand ${c.name} / ${b.name}`,
          data: { clientId: c.id, brandId: b.id, name: b.name, status: bStatus, version: next(heldBrand?.version) },
        });
      }
      const e = heldBrand?.entitlement ?? null;
      const want = wantTicketing ? "active" : "inactive";
      const differs = e ? e.status !== want || e.validFrom !== null || e.validUntil !== null : wantTicketing;
      if (differs) {
        entitlementEvents.push({
          type: "entitlement.updated",
          label: `ticketing ${c.name} / ${b.name}: ${want}`,
          data: { clientId: c.id, brandId: b.id, status: want, validFrom: null, validUntil: null, version: next(e?.version) },
        });
      }
    }
    // A Brand gone from TAKATAK keeps no Ticketing in ALKAO.
    for (const heldBrand of held?.brands ?? []) {
      if (c.brands.some((b) => b.id === heldBrand.brandId)) continue;
      if (heldBrand.entitlement && heldBrand.entitlement.status === "active") {
        entitlementEvents.push({
          type: "entitlement.updated",
          label: `ticketing ${c.name} / ${heldBrand.name}: inactive (brand removed)`,
          data: { clientId: c.id, brandId: heldBrand.brandId, status: "inactive", validFrom: null, validUntil: null, version: next(heldBrand.entitlement.version) },
        });
      }
    }

    const memberEvents: PlannedEvent[] = [];
    const seen = new Set<string>();
    for (const m of c.members) {
      if (!ROLES.includes(m.role as AlkaoRole)) {
        warnings.push(`${c.name}: member ${m.authUserId} has unknown role ${m.role}; skipped`);
        continue;
      }
      seen.add(m.authUserId);
      const mStatus = m.status === "active" && m.profileStatus === "active" ? "active" : "suspended";
      const heldMember = held?.members.find((x) => x.userId === m.authUserId);
      if (!heldMember && mStatus !== "active") continue;
      if (!heldMember || heldMember.role !== m.role || heldMember.status !== mStatus) {
        memberEvents.push({
          type: "membership.upserted",
          label: `member ${m.authUserId} ${m.role} ${mStatus}`,
          data: { clientId: c.id, userId: m.authUserId, role: m.role, status: mStatus, version: next(heldMember?.version) },
        });
      }
    }
    for (const heldMember of held?.members ?? []) {
      if (seen.has(heldMember.userId) || heldMember.status !== "active") continue;
      memberEvents.push({
        type: "membership.removed",
        label: `member ${heldMember.userId} removed`,
        data: { clientId: c.id, userId: heldMember.userId, version: next(heldMember.version) },
      });
    }
    events.push(...brandEvents, ...memberEvents, ...entitlementEvents);
  }

  // A Client taken off the list keeps its history in ALKAO but sells nothing more.
  for (const held of alkao) {
    if (settings.clientIds.has(held.clientId)) continue;
    for (const b of held.brands) {
      if (b.entitlement?.status === "active") {
        events.push({
          type: "entitlement.updated",
          label: `ticketing ${held.name} / ${b.name}: inactive (client not listed)`,
          data: { clientId: held.clientId, brandId: b.brandId, status: "inactive", validFrom: null, validUntil: null, version: next(b.entitlement.version) },
        });
      }
    }
  }
  return { events, warnings };
}
