// GROUPE TAKATAK Billing — client invoice center view model.
// Pure module. Maps provider invoices (Stripe subscriptions, Facturations
// issued invoices) to one read-only row shape for the client dashboard.
// Drafts are never shown to clients, only provider-hosted HTTPS links are
// rendered, and only verified provider payment evidence counts as paid.

import type { FacturationsIssuedInvoice } from "@/lib/integrations/facturations/contract";

export type ClientInvoiceSource = "stripe" | "facturations";

export type ClientInvoiceStatus = "paid" | "open" | "overdue" | "void" | "uncollectible" | "refunded";

export interface ClientInvoiceView {
  id: string;
  source: ClientInvoiceSource;
  number: string | null;
  description: string | null;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  currency: string;
  totalMinor: number;
  amountDueMinor: number;
  amountPaidMinor: number;
  status: ClientInvoiceStatus;
  /** Provider page where the client can view and pay. */
  payUrl: string | null;
  pdfUrl: string | null;
  /**
   * Facturations invoices only: this workspace's billing request id, set when
   * the invoice can be paid online through a TAKATAK Stripe Checkout session.
   */
  checkoutRequestId: string | null;
}

/** Minimal structural shape of a Stripe invoice (subset of Stripe.Invoice). */
export interface StripeInvoiceLike {
  id: string;
  number: string | null;
  description: string | null;
  created: number;
  due_date: number | null;
  currency: string;
  total: number;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  status: string | null;
  status_transitions?: { paid_at?: number | null } | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
}

const STRIPE_HOSTS = new Set(["invoice.stripe.com", "pay.stripe.com", "files.stripe.com"]);

export function safeProviderUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && STRIPE_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function isoFromSeconds(value: number | null | undefined): string | null {
  return Number.isSafeInteger(value) && (value as number) > 0
    ? new Date((value as number) * 1000).toISOString()
    : null;
}

function minor(value: unknown): number {
  return Number.isSafeInteger(value) ? (value as number) : 0;
}

/** Returns null for invoices a client must not see (drafts, unknown states). */
export function mapStripeInvoice(
  invoice: StripeInvoiceLike,
  now: Date = new Date(),
): ClientInvoiceView | null {
  const issuedAt = isoFromSeconds(invoice.created);

  if (!issuedAt || typeof invoice.id !== "string" || !invoice.id.startsWith("in_")) {
    return null;
  }

  let status: ClientInvoiceStatus;

  switch (invoice.status) {
    case "paid":
      status = "paid";
      break;
    case "void":
      status = "void";
      break;
    case "uncollectible":
      status = "uncollectible";
      break;
    case "open":
      status =
        invoice.due_date && invoice.due_date * 1000 < now.getTime() && minor(invoice.amount_remaining) > 0
          ? "overdue"
          : "open";
      break;
    default:
      return null; // draft or unknown: never shown to a client
  }

  return {
    id: invoice.id,
    source: "stripe",
    number: typeof invoice.number === "string" ? invoice.number.slice(0, 64) : null,
    description: typeof invoice.description === "string" ? invoice.description.slice(0, 200) : null,
    issuedAt,
    dueAt: isoFromSeconds(invoice.due_date),
    paidAt: isoFromSeconds(invoice.status_transitions?.paid_at ?? null),
    currency: typeof invoice.currency === "string" ? invoice.currency.toUpperCase().slice(0, 3) : "CAD",
    totalMinor: minor(invoice.total),
    amountDueMinor: status === "open" || status === "overdue" ? minor(invoice.amount_remaining) : 0,
    amountPaidMinor: minor(invoice.amount_paid),
    status,
    payUrl: status === "open" || status === "overdue" || status === "paid"
      ? safeProviderUrl(invoice.hosted_invoice_url)
      : null,
    pdfUrl: safeProviderUrl(invoice.invoice_pdf),
    checkoutRequestId: null,
  };
}

/**
 * Maps a Facturations-issued invoice (linked to this workspace through its
 * own billing request) to a client row. Synthetic or missing payment
 * evidence never makes an invoice look paid to a client.
 */
export function mapFacturationsInvoice(
  input: {
    requestId: string;
    invoice: FacturationsIssuedInvoice;
    dueDate: string | null;
    description: string | null;
  },
  now: Date = new Date(),
): ClientInvoiceView {
  const total = Number(input.invoice.totalCents);
  const verified = input.invoice.proofScope === "VERIFIED_PROVIDER_PRESENT";
  const balance = verified ? Number(input.invoice.balanceCents) : total;
  const state = verified ? input.invoice.financialState : "NO_EVIDENCE";
  const dueAt =
    input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)
      ? new Date(`${input.dueDate}T23:59:59.000-05:00`).toISOString()
      : null;

  let status: ClientInvoiceStatus;

  if (state === "PAID" || state === "OVERPAID") {
    status = "paid";
  } else if (state === "FULLY_REFUNDED") {
    status = "refunded";
  } else {
    status = dueAt && Date.parse(dueAt) < now.getTime() && balance > 0 ? "overdue" : "open";
  }

  return {
    id: `fact_${input.requestId}`,
    source: "facturations",
    number: input.invoice.officialInvoiceNumber.slice(0, 64),
    description: input.description ? input.description.slice(0, 200) : null,
    issuedAt: input.invoice.issuedAt,
    dueAt,
    paidAt: null,
    currency: "CAD",
    totalMinor: Number.isSafeInteger(total) ? total : 0,
    amountDueMinor: status === "open" || status === "overdue" ? Math.max(0, balance) : 0,
    amountPaidMinor: verified ? Math.max(0, total - balance) : 0,
    status,
    payUrl: null,
    pdfUrl: null,
    checkoutRequestId:
      (status === "open" || status === "overdue") && balance > 0 && Number.isSafeInteger(balance)
        ? input.requestId
        : null,
  };
}

export interface ClientInvoiceSummary {
  currency: string;
  outstandingMinor: number;
  overdueCount: number;
  lastPaidAt: string | null;
}

export function summarizeClientInvoices(invoices: ClientInvoiceView[]): ClientInvoiceSummary {
  const outstanding = invoices.filter((invoice) => invoice.status === "open" || invoice.status === "overdue");
  const paidDates = invoices
    .map((invoice) => invoice.paidAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const lastPaid = paidDates.length > 0 ? paidDates[paidDates.length - 1] : null;

  return {
    currency: outstanding[0]?.currency ?? invoices[0]?.currency ?? "CAD",
    outstandingMinor: outstanding.reduce((sum, invoice) => sum + invoice.amountDueMinor, 0),
    overdueCount: outstanding.filter((invoice) => invoice.status === "overdue").length,
    lastPaidAt: lastPaid,
  };
}

export function formatMinor(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}
