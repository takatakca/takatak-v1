// GROUPE TAKATAK Billing — website order lead → Facturations draft (TK-027).
// Pure module. A won "package_order" lead from takatak.ca becomes one invoice
// request in the central billing queue. Lines and prices come only from the
// catalog-priced order the server stored on the lead; taxes are explicit
// choices of the person billing (no jurisdiction is ever assumed).

import type { InvoiceDraftInput, InvoiceLineInput, InvoiceTaxInput } from "./draft-input";
import { INVOICE_LIMITS } from "./draft-input";

export const LEAD_ORDER_SOURCE_APP = "takatak_core" as const;
export const LEAD_ORDER_MAX_DUE_DAYS = 90;

export interface LeadOrderPricing {
  title: string;
  tierName: string;
  deliveryDays: number;
  tierPriceCents: number;
  addons: { label: string; priceCents: number }[];
  subtotalCents: number;
  discountCents: number;
  promoCode: string | null;
  totalCents: number;
}

export type LeadOrderBlocker = "not_an_order" | "not_won" | "no_email" | "no_name";

export function leadOrderSourceReference(leadId: string): string {
  return `website-order:${leadId.toLowerCase()}`;
}

function cents(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/**
 * Reads the server-priced order stored on a website lead. Returns null for
 * any other lead, or when the stored order is incomplete or inconsistent.
 */
export function readLeadOrder(metadata: unknown): LeadOrderPricing | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  if (m.origin !== "takatak_website" || m.kind !== "package_order") return null;
  const order = m.order;
  if (!order || typeof order !== "object" || Array.isArray(order)) return null;
  const o = order as Record<string, unknown>;

  const title = text(o.title, 120);
  const tierName = text(o.tierName, 60);
  const tierPriceCents = cents(o.tierPriceCents);
  const subtotalCents = cents(o.subtotalCents);
  const discountCents = cents(o.discountCents) ?? 0;
  const totalCents = cents(o.totalCents);
  const deliveryDays = cents(o.deliveryDays) ?? 0;
  const rawAddons = Array.isArray(o.addons) ? o.addons : null;

  if (!title || !tierName || tierPriceCents === null || subtotalCents === null || totalCents === null || !rawAddons) return null;

  const addons: LeadOrderPricing["addons"] = [];
  for (const raw of rawAddons) {
    const addon = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    const label = addon ? text(addon.label, 120) : null;
    const priceCents = addon ? cents(addon.priceCents) : null;
    if (!label || priceCents === null) return null;
    addons.push({ label, priceCents });
  }

  // The stored order must add up, otherwise it is not billed automatically.
  const sum = tierPriceCents + addons.reduce((total, addon) => total + addon.priceCents, 0);
  if (sum !== subtotalCents || discountCents > subtotalCents || subtotalCents - discountCents !== totalCents) return null;
  if (addons.length + 1 > INVOICE_LIMITS.maxLines) return null;

  return {
    title,
    tierName,
    deliveryDays,
    tierPriceCents,
    addons,
    subtotalCents,
    discountCents,
    promoCode: text(o.promoCode, 40),
    totalCents,
  };
}

export function leadOrderBlockers(lead: {
  status: string;
  name: string | null;
  company: string | null;
  email: string | null;
  metadata: unknown;
}): LeadOrderBlocker[] {
  const blockers: LeadOrderBlocker[] = [];
  if (!readLeadOrder(lead.metadata)) blockers.push("not_an_order");
  if (lead.status !== "won_internal") blockers.push("not_won");
  if (!lead.email) blockers.push("no_email");
  if (!text(lead.name, 160) && !text(lead.company, 160)) blockers.push("no_name");
  return blockers;
}

/**
 * Spreads a whole-order discount over the lines in proportion to their price
 * (largest remainder), so the invoice total equals the quoted total exactly.
 */
export function allocateDiscount(prices: number[], discountCents: number): number[] {
  const subtotal = prices.reduce((total, price) => total + price, 0);
  if (discountCents <= 0 || subtotal <= 0) return prices.map(() => 0);
  const exact = prices.map((price) => (price * discountCents) / subtotal);
  const shares = exact.map(Math.floor);
  let left = discountCents - shares.reduce((total, share) => total + share, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || prices[b.index] - prices[a.index]);
  for (const { index } of order) {
    if (left === 0) break;
    if (shares[index] < prices[index]) {
      shares[index] += 1;
      left -= 1;
    }
  }
  return shares;
}

/** YYYY-MM-DD in Montréal time, plus a number of days. */
export function torontoDate(now: Date, plusDays = 0): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + plusDays);
  return date.toISOString().slice(0, 10);
}

export function buildLeadOrderDraft(input: {
  order: LeadOrderPricing;
  customer: { name: string; email: string };
  taxes: InvoiceTaxInput[];
  dueInDays: number;
  reference: string;
  now?: Date;
}): InvoiceDraftInput {
  const now = input.now ?? new Date();
  const { order } = input;
  const items = [
    { description: `${order.title} — ${order.tierName}${order.deliveryDays > 0 ? ` (${order.deliveryDays} days)` : ""}`, price: order.tierPriceCents },
    ...order.addons.map((addon) => ({ description: `Add-on: ${addon.label}`, price: addon.priceCents })),
  ];
  const discounts = allocateDiscount(items.map((item) => item.price), order.discountCents);
  const lines: InvoiceLineInput[] = items.map((item, index) => ({
    description: item.description.slice(0, INVOICE_LIMITS.lineDescription),
    quantity: 1,
    unitPriceCents: item.price,
    discountCents: discounts[index],
    taxable: true,
  }));
  const promo = order.discountCents > 0 && order.promoCode ? ` Promo ${order.promoCode} applied.` : "";

  return {
    currency: "CAD",
    customer: { name: input.customer.name.slice(0, INVOICE_LIMITS.customerName), email: input.customer.email, address: null },
    invoiceDate: torontoDate(now),
    dueDate: torontoDate(now, input.dueInDays),
    notes: `takatak.ca order ${input.reference}.${promo}`.slice(0, INVOICE_LIMITS.notes),
    lines,
    taxes: input.taxes,
  };
}

export function parseLeadOrderBillingBody(
  body: unknown,
): { ok: true; taxes: InvoiceTaxInput[]; dueInDays: number } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, message: "Invalid request." };
  const b = body as Record<string, unknown>;
  const dueInDays = b.dueInDays;
  if (!Number.isSafeInteger(dueInDays) || (dueInDays as number) < 0 || (dueInDays as number) > LEAD_ORDER_MAX_DUE_DAYS) {
    return { ok: false, message: `Due date must be 0 to ${LEAD_ORDER_MAX_DUE_DAYS} days.` };
  }
  if (!Array.isArray(b.taxes) || b.taxes.length > INVOICE_LIMITS.maxTaxes) {
    return { ok: false, message: `Choose at most ${INVOICE_LIMITS.maxTaxes} taxes.` };
  }
  const taxes: InvoiceTaxInput[] = [];
  for (const raw of b.taxes) {
    const tax = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    if (!tax || typeof tax.code !== "string" || typeof tax.label !== "string" || !Number.isSafeInteger(tax.rateMilliPercent)) {
      return { ok: false, message: "Each tax needs a code, a label and a rate." };
    }
    taxes.push({ code: tax.code, label: tax.label, rateMilliPercent: tax.rateMilliPercent as number });
  }
  // Full validation (codes, labels, rate range) happens in the billing queue.
  return { ok: true, taxes, dueInDays: dueInDays as number };
}
