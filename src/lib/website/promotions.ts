/**
 * TAKATAK promotions — frontend state for the FIRST10 first-service offer.
 *
 * Source of truth is the backend (see TAKATAK_PROMOTIONS_CONTRACT.md). Until
 * those endpoints are live, this module persists user-level state locally so
 * the UX is consistent. Discounts are previewed only; final totals must be
 * calculated server-side and never marked as paid client-side.
 */

export const PROMO_CODE = "FIRST10";
export const PROMO_PERCENT = 10;
export const PROMO_HEADLINE = "10% off your first TAKATAK service";
export const PROMO_SUBLINE =
  "New clients get 10% off their first eligible TAKATAK service order.";

export type PromoStatus =
  | "none"
  | "pending"   // saved before signup
  | "claimed"   // verified user has the offer available
  | "used"      // already redeemed
  | "dismissed";

export interface PromoState {
  code: string;
  percentOff: number;
  status: PromoStatus;
  claimedAt?: string;
  usedAt?: string;
}

const KEY = "takatak.promo.first10";
const DISMISS_KEY = "takatak.promo.bar.dismissed";
const MODAL_KEY = "takatak.promo.modal.shown";
const STICKY_KEY = "takatak.promo.sticky.dismissed";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function read<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

export function getPromoState(): PromoState {
  return (
    read<PromoState>(KEY) ?? {
      code: PROMO_CODE,
      percentOff: PROMO_PERCENT,
      status: "none",
    }
  );
}

export function savePendingPromo() {
  const current = getPromoState();
  if (current.status === "claimed" || current.status === "used") return current;
  const next: PromoState = { ...current, status: "pending" };
  write(KEY, next);
  return next;
}

/** Called after signup/OTP verification completes. */
export function claimPromo(): PromoState {
  const current = getPromoState();
  if (current.status === "used") return current;
  const next: PromoState = {
    code: PROMO_CODE,
    percentOff: PROMO_PERCENT,
    status: "claimed",
    claimedAt: new Date().toISOString(),
  };
  write(KEY, next);
  return next;
}

export function markPromoUsed(): PromoState {
  const next: PromoState = {
    ...getPromoState(),
    status: "used",
    usedAt: new Date().toISOString(),
  };
  write(KEY, next);
  return next;
}

export function dismissPromoBar() {
  write(DISMISS_KEY, { at: Date.now() });
}
export function isPromoBarDismissed() {
  return !!read<{ at: number }>(DISMISS_KEY);
}

export function dismissStickyPromo() {
  write(STICKY_KEY, { at: Date.now() });
}
export function isStickyPromoDismissed() {
  return !!read<{ at: number }>(STICKY_KEY);
}

export function markModalShown() {
  write(MODAL_KEY, { at: Date.now() });
}
export function wasModalShown() {
  return !!read<{ at: number }>(MODAL_KEY);
}

/** Preview only — server is the source of truth for final totals. */
export function previewDiscount(subtotalCents: number) {
  const off = Math.round((subtotalCents * PROMO_PERCENT) / 100);
  return { discountCents: off, totalCents: Math.max(0, subtotalCents - off) };
}

/** Frontend analytics — no-op if dataLayer is absent. */
export type PromoEvent =
  | "promo_banner_viewed"
  | "promo_banner_clicked"
  | "signup_promo_viewed"
  | "signup_promo_claimed"
  | "signup_completed_with_promo"
  | "promo_applied_to_checkout";

export function trackPromo(event: PromoEvent, payload: Record<string, unknown> = {}) {
  if (!isBrowser()) return;
  try {
    const w = window as unknown as {
      dataLayer?: Array<Record<string, unknown>>;
    };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event, promo_code: PROMO_CODE, ...payload });
  } catch {
    /* ignore */
  }
}

/** Listen for promo state changes across tabs and within the tab. */
export function onPromoStateChange(cb: (s: PromoState) => void) {
  if (!isBrowser()) return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === KEY) cb(getPromoState());
  };
  window.addEventListener("storage", handler);
  // also poll once for same-tab updates
  return () => window.removeEventListener("storage", handler);
}

// ---------------------------------------------------------------------------
// Backend-first API (with local fallback)
// ---------------------------------------------------------------------------

import { apiGet, apiPost } from "./api-client";

export interface BackendPromotion {
  id: string;
  code: string;
  status: "available" | "claimed" | "applied" | "redeemed" | "expired" | "cancelled";
  percentOff: number;
  claimedAt?: string | null;
  appliedAt?: string | null;
  redeemedAt?: string | null;
  orderId?: string | null;
}

export interface PromoApplyPreview {
  code: string;
  promotionId: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

export async function fetchMyPromotions(): Promise<{ promotions: BackendPromotion[]; available: Array<{ code: string; percentOff: number; status: "available" }> } | null> {
  try {
    return await apiGet("/promotions/me");
  } catch {
    return null;
  }
}

/** Backend-first claim. Falls back to local state when the API is unavailable. */
export async function claimPromoBackend(code = PROMO_CODE): Promise<{ promotion: BackendPromotion } | { fallback: true; state: PromoState }> {
  try {
    const r = await apiPost<{ promotion: BackendPromotion }>("/promotions/claim", { code });
    // Mirror to local state so existing UI keeps working.
    write(KEY, { code, percentOff: PROMO_PERCENT, status: "claimed", claimedAt: new Date().toISOString() } satisfies PromoState);
    return r;
  } catch {
    return { fallback: true, state: claimPromo() };
  }
}

/** Preview discount for a given subtotal and/or order. Returns null when backend is unreachable. */
export async function previewPromoBackend(input: { code?: string; subtotalCents?: number; orderId?: string }): Promise<PromoApplyPreview | null> {
  const code = (input.code ?? PROMO_CODE).toUpperCase();
  try {
    return await apiPost<PromoApplyPreview>("/promotions/apply", {
      code,
      orderId: input.orderId,
      subtotalCents: input.subtotalCents,
    });
  } catch {
    return null;
  }
}