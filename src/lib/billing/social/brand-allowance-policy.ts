/**
 * Pure Brand freeze / restore and scheduled-post blocking.
 * Does not write the database. Does not talk to Stripe.
 */

import {
  isFrozenBrandStatus,
  isLiveBrandStatus,
} from "@/lib/brands/live-brand-where";

export type BrandAllowanceRow = {
  id: string;
  createdAt: Date | string;
  status: string;
};

export type BrandFreezePlan = {
  allowance: number;
  billableCount: number;
  frozenCount: number;
  overAllowance: boolean;
  needsSelection: boolean;
  canAutoRestore: boolean;
  defaultKeepIds: string[];
  freezeIds: string[];
  restoreIds: string[];
};

export type ScheduledPostRow = {
  id: string;
  brandId: string | null;
  status: string;
  scheduledAt: Date | string | null;
};

function createdAtMs(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
}

function scheduledAtMs(value: Date | string | null): number {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return Number.MAX_SAFE_INTEGER;
  }

  return date.getTime();
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function oldestFirst(rows: BrandAllowanceRow[]): BrandAllowanceRow[] {
  return [...rows].sort((a, b) => {
    const delta = createdAtMs(a.createdAt) - createdAtMs(b.createdAt);
    if (delta !== 0) {
      return delta;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * When access is blocked (suspended / incomplete / paused), allowance is 0.
 * Missing subscription rows use the Free plan allowance (1), not zero.
 */
export function effectiveBrandAllowance(
  access: "paid" | "free" | "blocked",
  brandAllowance: number,
  displayKey?: string,
): number {
  if (access === "blocked" && displayKey !== "missing") {
    return 0;
  }

  return Math.max(0, Math.floor(brandAllowance));
}

export function planBrandFreeze(
  brands: BrandAllowanceRow[],
  allowance: number,
  keepIds: string[] | null,
): BrandFreezePlan {
  const usable = brands.filter((brand) => brand.status !== "archived");
  const billable = usable.filter((brand) => isLiveBrandStatus(brand.status));
  const frozen = usable.filter((brand) => isFrozenBrandStatus(brand.status));
  const cap = Math.max(0, Math.floor(allowance));

  const billableCount = billable.length;
  const frozenCount = frozen.length;
  const overAllowance = billableCount > cap;
  const canAutoRestore = !overAllowance && frozenCount > 0 && cap > billableCount;

  if (keepIds) {
    const wanted = uniqueIds(keepIds);
    const byId = new Map(usable.map((brand) => [brand.id, brand]));
    const selected = wanted
      .map((id) => byId.get(id))
      .filter((brand): brand is BrandAllowanceRow => Boolean(brand));

    if (selected.length !== wanted.length || selected.length > cap) {
      return {
        allowance: cap,
        billableCount,
        frozenCount,
        overAllowance,
        needsSelection: overAllowance,
        canAutoRestore,
        defaultKeepIds: oldestFirst(billable).slice(0, cap).map((brand) => brand.id),
        freezeIds: [],
        restoreIds: [],
      };
    }

    const keepSet = new Set(selected.map((brand) => brand.id));
    const freezeIds = billable
      .filter((brand) => !keepSet.has(brand.id))
      .map((brand) => brand.id);
    const restoreIds = frozen
      .filter((brand) => keepSet.has(brand.id))
      .map((brand) => brand.id);

    return {
      allowance: cap,
      billableCount,
      frozenCount,
      overAllowance,
      needsSelection: false,
      canAutoRestore: false,
      defaultKeepIds: selected.map((brand) => brand.id),
      freezeIds,
      restoreIds,
    };
  }

  if (overAllowance) {
    const keep = oldestFirst(billable).slice(0, cap);
    const keepSet = new Set(keep.map((brand) => brand.id));
    return {
      allowance: cap,
      billableCount,
      frozenCount,
      overAllowance: true,
      needsSelection: true,
      canAutoRestore: false,
      defaultKeepIds: keep.map((brand) => brand.id),
      freezeIds: billable
        .filter((brand) => !keepSet.has(brand.id))
        .map((brand) => brand.id),
      restoreIds: [],
    };
  }

  const slots = cap - billableCount;
  const restoreIds = oldestFirst(frozen).slice(0, slots).map((brand) => brand.id);

  return {
    allowance: cap,
    billableCount,
    frozenCount,
    overAllowance: false,
    needsSelection: false,
    canAutoRestore: restoreIds.length > 0,
    defaultKeepIds: billable.map((brand) => brand.id),
    freezeIds: [],
    restoreIds,
  };
}

export function isKeepSelectionValid(
  brands: BrandAllowanceRow[],
  allowance: number,
  keepIds: string[],
): boolean {
  const cap = Math.max(0, Math.floor(allowance));
  const usable = brands.filter((brand) => brand.status !== "archived");
  const unique = uniqueIds(keepIds);

  if (unique.length !== keepIds.length) {
    return false;
  }

  if (unique.some((id) => !usable.some((brand) => brand.id === id))) {
    return false;
  }

  if (cap === 0) {
    return unique.length === 0;
  }

  if (usable.length === 0) {
    return unique.length === 0;
  }

  return unique.length >= 1 && unique.length <= cap;
}

/**
 * Freeze scheduled posts on frozen Brands.
 * If the monthly cap is set, keep the earliest scheduled posts up to the cap
 * on live Brands; the rest become blocked_by_plan.
 */
export function planScheduledPostBlocks(input: {
  posts: ScheduledPostRow[];
  frozenBrandIds: readonly string[];
  monthlyPostAllowance: number | null;
}): string[] {
  const frozen = new Set(input.frozenBrandIds);
  const scheduled = input.posts.filter(
    (post) => post.status === "scheduled",
  );
  const block = new Set<string>();

  for (const post of scheduled) {
    if (post.brandId && frozen.has(post.brandId)) {
      block.add(post.id);
    }
  }

  if (input.monthlyPostAllowance === null) {
    return [...block];
  }

  const cap = Math.max(0, Math.floor(input.monthlyPostAllowance));
  const liveScheduled = scheduled
    .filter((post) => !block.has(post.id))
    .sort((a, b) => {
      const delta = scheduledAtMs(a.scheduledAt) - scheduledAtMs(b.scheduledAt);
      if (delta !== 0) {
        return delta;
      }
      return a.id.localeCompare(b.id);
    });

  for (const post of liveScheduled.slice(cap)) {
    block.add(post.id);
  }

  return [...block];
}
