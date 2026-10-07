// GROUPE TAKATAK Billing — client invoice center view model.
// Pure module. Maps provider invoices (Stripe today, Facturations next) to
// one read-only row shape for the client dashboard. Drafts are never shown
// to clients, and only provider-hosted HTTPS links are ever rendered.

export type ClientInvoiceSource = "stripe";

export type ClientInvoiceStatus = "paid" | "open" | "overdue" | "void" | "uncollectible";

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
