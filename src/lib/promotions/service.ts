// Account-level promotion state. Persisted by the caller (audit log in
// production, memory in tests). A redeemed code discounts exactly one order.

import {
  listAvailablePromos,
  lookupPromo,
  normalizePromoCode,
  quotePromo,
  type KnownPromo,
  isValidSubtotalCents,
} from "./catalog";

export type PromoAction = "promo.claim" | "promo.redeem";

export type PromoEvent = {
  id: string;
  action: PromoAction;
  createdAt: string;
  orderRef: string | null;
};

export type PromoStore = {
  list(profileId: string, code: string): Promise<PromoEvent[]>;
  append(input: {
    profileId: string;
    action: PromoAction;
    code: string;
    orderRef: string | null;
  }): Promise<PromoEvent>;
};

export type AccountPromotion = {
  id: string;
  code: string;
  status: "claimed" | "redeemed";
  percentOff: number;
  claimedAt: string | null;
  redeemedAt: string | null;
  orderId: string | null;
};

export type PromoPreview = {
  code: string;
  promotionId: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  accepted: boolean;
};

export function createMemoryPromoStore(): PromoStore {
  const rows: Array<PromoEvent & { profileId: string; code: string }> = [];
  return {
    async list(profileId, code) {
      return rows
        .filter((row) => row.profileId === profileId && row.code === code)
        .map(({ id, action, createdAt, orderRef }) => ({
          id,
          action,
          createdAt,
          orderRef,
        }));
    },
    async append(input) {
      const event: PromoEvent & { profileId: string; code: string } = {
        id: `mem-${rows.length + 1}`,
        action: input.action,
        createdAt: new Date().toISOString(),
        orderRef: input.orderRef,
        profileId: input.profileId,
        code: input.code,
      };
      rows.push(event);
      return event;
    },
  };
}

export function statusFromEvents(
  events: PromoEvent[],
): "none" | "claimed" | "redeemed" {
  if (events.some((event) => event.action === "promo.redeem")) return "redeemed";
  if (events.some((event) => event.action === "promo.claim")) return "claimed";
  return "none";
}

function toAccountPromotion(
  known: KnownPromo,
  events: PromoEvent[],
  status: "claimed" | "redeemed",
): AccountPromotion {
  const claim = events.find((event) => event.action === "promo.claim") ?? null;
  const redeem = events.find((event) => event.action === "promo.redeem") ?? null;
  const anchor = status === "redeemed" ? redeem ?? claim : claim ?? redeem;
  return {
    id: anchor?.id ?? known.code,
    code: known.code,
    status,
    percentOff: known.percentOff,
    claimedAt: claim?.createdAt ?? null,
    redeemedAt: redeem?.createdAt ?? null,
    orderId: redeem?.orderRef ?? null,
  };
}

export async function claimPromo(
  store: PromoStore,
  profileId: string,
  rawCode: unknown,
): Promise<
  | { ok: true; promotion: AccountPromotion }
  | { ok: false; code: "invalid_code" | "already_redeemed" }
> {
  const code = normalizePromoCode(rawCode);
  const known = lookupPromo(code);
  if (!known) return { ok: false, code: "invalid_code" };
  const events = await store.list(profileId, known.code);
  const status = statusFromEvents(events);
  if (status === "redeemed") return { ok: false, code: "already_redeemed" };
  if (status === "claimed") {
    return { ok: true, promotion: toAccountPromotion(known, events, "claimed") };
  }
  const created = await store.append({
    profileId,
    action: "promo.claim",
    code: known.code,
    orderRef: null,
  });
  return {
    ok: true,
    promotion: toAccountPromotion(known, [created], "claimed"),
  };
}

export async function redeemPromo(
  store: PromoStore,
  profileId: string,
  rawCode: unknown,
  orderRef: string,
): Promise<"redeemed" | "already_redeemed" | "invalid_code"> {
  const code = normalizePromoCode(rawCode);
  const known = lookupPromo(code);
  if (!known) return "invalid_code";
  const events = await store.list(profileId, known.code);
  if (statusFromEvents(events) === "redeemed") return "already_redeemed";
  await store.append({
    profileId,
    action: "promo.redeem",
    code: known.code,
    orderRef: orderRef.slice(0, 80),
  });
  return "redeemed";
}

export async function promoStatus(
  store: PromoStore,
  profileId: string,
  rawCode: unknown,
): Promise<"none" | "claimed" | "redeemed" | "invalid_code"> {
  const code = normalizePromoCode(rawCode);
  const known = lookupPromo(code);
  if (!known) return "invalid_code";
  return statusFromEvents(await store.list(profileId, known.code));
}

export async function previewPromo(
  store: PromoStore,
  profileId: string | null,
  rawCode: unknown,
  subtotalCents: unknown,
): Promise<
  | { ok: true; preview: PromoPreview }
  | { ok: false; code: "invalid_code" | "invalid_amount" }
> {
  const code = normalizePromoCode(rawCode);
  const known = lookupPromo(code);
  if (!known) return { ok: false, code: "invalid_code" };
  if (!isValidSubtotalCents(subtotalCents)) {
    return { ok: false, code: "invalid_amount" };
  }
  const status = profileId
    ? statusFromEvents(await store.list(profileId, known.code))
    : "none";
  const quoted =
    status === "redeemed"
      ? {
          discountCents: 0,
          totalCents: subtotalCents,
        }
      : quotePromo(subtotalCents, known.code);
  return {
    ok: true,
    preview: {
      code: known.code,
      promotionId: known.code,
      subtotalCents,
      discountCents: quoted.discountCents,
      totalCents: quoted.totalCents,
      accepted: status !== "redeemed",
    },
  };
}

export async function listMyPromos(
  store: PromoStore,
  profileId: string,
): Promise<{
  promotions: AccountPromotion[];
  available: Array<{ code: string; percentOff: number; status: "available" }>;
}> {
  const promotions: AccountPromotion[] = [];
  const available: Array<{ code: string; percentOff: number; status: "available" }> =
    [];
  for (const known of listAvailablePromos()) {
    const events = await store.list(profileId, known.code);
    const status = statusFromEvents(events);
    if (status === "none") {
      available.push({
        code: known.code,
        percentOff: known.percentOff,
        status: "available",
      });
    } else {
      promotions.push(toAccountPromotion(known, events, status));
    }
  }
  return { promotions, available };
}
