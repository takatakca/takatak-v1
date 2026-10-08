// GROUPE TAKATAK Billing — local invoice estimate.
// Pure module. Same arithmetic as Facturations src/draft-preview.js:
//   line net   = quantity * unitPriceCents - discountCents
//   each tax   = round_half_up(taxableSubtotal * rateMilliPercent / 100000)
//   total      = subtotal + sum(taxes)        (independent taxes, no compounding)
// Facturations always recalculates on its side; this estimate is only used to
// display and audit what TAKATAK sent. It is never an issued amount.

import type { InvoiceDraftInput } from "./draft-input";

export const MAX_INVOICE_TOTAL_CENTS = BigInt(1_000_000_000_000);
const ZERO = BigInt(0);
const HALF_UP = BigInt(50_000);
const MILLI_PERCENT_BASE = BigInt(100_000);

export interface InvoiceEstimateLine {
  description: string;
  lineTotalCents: number;
}

export interface InvoiceEstimateTax {
  code: string;
  label: string;
  rateMilliPercent: number;
  amountCents: number;
}

export interface InvoiceEstimate {
  status: "ESTIMATE_ONLY";
  currency: "CAD";
  lines: InvoiceEstimateLine[];
  taxes: InvoiceEstimateTax[];
  subtotalCents: number;
  taxableSubtotalCents: number;
  taxTotalCents: number;
  totalCents: number;
}

export class InvoiceAmountTooLargeError extends Error {
  constructor() {
    super("The invoice amount is too large.");
    this.name = "InvoiceAmountTooLargeError";
  }
}

function toCents(value: bigint): number {
  if (value > MAX_INVOICE_TOTAL_CENTS) {
    throw new InvoiceAmountTooLargeError();
  }

  return Number(value);
}

export function estimateInvoice(input: InvoiceDraftInput): InvoiceEstimate {
  let subtotal = ZERO;
  let taxableSubtotal = ZERO;

  const lines = input.lines.map((line) => {
    const net =
      BigInt(line.quantity) * BigInt(line.unitPriceCents) -
      BigInt(line.discountCents);

    subtotal += net;

    if (line.taxable) {
      taxableSubtotal += net;
    }

    return { description: line.description, lineTotalCents: toCents(net) };
  });

  const taxes = input.taxes.map((tax) => ({
    code: tax.code,
    label: tax.label,
    rateMilliPercent: tax.rateMilliPercent,
    amountCents: toCents(
      (taxableSubtotal * BigInt(tax.rateMilliPercent) + HALF_UP) / MILLI_PERCENT_BASE,
    ),
  }));

  const taxTotal = taxes.reduce((sum, tax) => sum + BigInt(tax.amountCents), ZERO);

  return {
    status: "ESTIMATE_ONLY",
    currency: "CAD",
    lines,
    taxes,
    subtotalCents: toCents(subtotal),
    taxableSubtotalCents: toCents(taxableSubtotal),
    taxTotalCents: toCents(taxTotal),
    totalCents: toCents(subtotal + taxTotal),
  };
}

export function formatCad(cents: number | bigint | string): string {
  const value = typeof cents === "bigint" ? Number(cents) : Number(cents);

  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number.isFinite(value) ? value / 100 : 0);
}
