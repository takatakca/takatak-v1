// Client invoicing — actions on an invoice the workspace already sent from
// its own connected Stripe account, and the dashboard summary. Pure module.
// Only open invoices can be acted on; amounts are summed per currency and
// never mixed.

import type { ClientInvoiceStatus, ClientInvoiceView } from "@/lib/billing/client-invoices/invoice-view";

import { clientInvoiceIdempotencyKey } from "./invoice-keys";

export const CLIENT_INVOICE_ACTIONS = ["remind", "void", "mark_paid"] as const;

export type ClientInvoiceAction = (typeof CLIENT_INVOICE_ACTIONS)[number];

const STRIPE_INVOICE_ID = /^in_[A-Za-z0-9]{8,64}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isStripeInvoiceId(value: unknown): value is string {
  return typeof value === "string" && STRIPE_INVOICE_ID.test(value);
}

export function parseClientInvoiceAction(
  body: unknown,
): { ok: true; action: ClientInvoiceAction } | { ok: false; message: string } {
  const action = body && typeof body === "object" ? (body as { action?: unknown }).action : undefined;

  return typeof action === "string" && (CLIENT_INVOICE_ACTIONS as readonly string[]).includes(action)
    ? { ok: true, action: action as ClientInvoiceAction }
    : { ok: false, message: "Action inconnue." };
}

/** Reminders, voiding and offline payment only apply to unpaid, open invoices. */
export function canActOnClientInvoice(status: ClientInvoiceStatus): boolean {
  return status === "open" || status === "overdue";
}

/**
 * Stripe idempotency key for one action. A reminder is keyed by UTC day, so
 * repeated clicks send at most one email per invoice per day; void and
 * mark-paid can only ever happen once.
 */
export function clientInvoiceActionKey(
  clientId: string,
  invoiceId: string,
  action: ClientInvoiceAction,
  now: Date = new Date(),
): string {
  const step = action === "remind" ? `remind:${now.toISOString().slice(0, 10)}` : action;

  return clientInvoiceIdempotencyKey(clientId, "invoice-action", `${invoiceId}:${step}`);
}

export interface ClientInvoicingSummary {
  currency: string;
  outstandingMinor: number;
  outstandingCount: number;
  overdueMinor: number;
  overdueCount: number;
  paidLast30DaysMinor: number;
  paidLast30DaysCount: number;
  /** Invoices in another currency, left out of the totals above. */
  otherCurrencyCount: number;
}

export function summarizeClientIssuedInvoices(
  invoices: ClientInvoiceView[],
  now: Date = new Date(),
  currency = "CAD",
): ClientInvoicingSummary {
  const summary: ClientInvoicingSummary = {
    currency,
    outstandingMinor: 0,
    outstandingCount: 0,
    overdueMinor: 0,
    overdueCount: 0,
    paidLast30DaysMinor: 0,
    paidLast30DaysCount: 0,
    otherCurrencyCount: 0,
  };
  const since = now.getTime() - 30 * DAY_MS;

  for (const invoice of invoices) {
    if (invoice.currency !== currency) {
      summary.otherCurrencyCount += 1;
      continue;
    }

    if (canActOnClientInvoice(invoice.status)) {
      summary.outstandingMinor += invoice.amountDueMinor;
      summary.outstandingCount += 1;
    }

    if (invoice.status === "overdue") {
      summary.overdueMinor += invoice.amountDueMinor;
      summary.overdueCount += 1;
    }

    const paidAt = invoice.status === "paid" && invoice.paidAt ? Date.parse(invoice.paidAt) : NaN;

    if (paidAt >= since && paidAt <= now.getTime()) {
      summary.paidLast30DaysMinor += invoice.amountPaidMinor;
      summary.paidLast30DaysCount += 1;
    }
  }

  return summary;
}

export const CLIENT_INVOICE_FILTERS = ["all", "unpaid", "overdue", "paid"] as const;

export type ClientInvoiceFilter = (typeof CLIENT_INVOICE_FILTERS)[number];

export function parseClientInvoiceFilter(value: unknown): ClientInvoiceFilter {
  return typeof value === "string" && (CLIENT_INVOICE_FILTERS as readonly string[]).includes(value)
    ? (value as ClientInvoiceFilter)
    : "all";
}

export function filterClientIssuedInvoices<T extends ClientInvoiceView>(invoices: T[], filter: ClientInvoiceFilter): T[] {
  switch (filter) {
    case "unpaid":
      return invoices.filter((invoice) => canActOnClientInvoice(invoice.status));
    case "overdue":
      return invoices.filter((invoice) => invoice.status === "overdue");
    case "paid":
      return invoices.filter((invoice) => invoice.status === "paid");
    default:
      return invoices;
  }
}
