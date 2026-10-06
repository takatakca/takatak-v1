// GROUPE TAKATAK Billing — deterministic idempotency and payload hashing.
// Pure module (node:crypto only).
//
// One (sourceApp, sourceReference) pair maps to exactly one Facturations
// Idempotency-Key, forever. Retries after a timeout reuse the same key, so
// Facturations returns the same draft instead of creating a duplicate.

import { createHash } from "node:crypto";

import type { InvoiceDraftInput } from "./draft-input";
import type { BillingSourceApp } from "./source-apps";

const IDEMPOTENCY_DOMAIN = "takatak-billing-facturations-idempotency-v1";
const PAYLOAD_DOMAIN = "takatak-billing-invoice-request-v1";

export const FACTURATIONS_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;

export function deriveFacturationsIdempotencyKey(
  sourceApp: BillingSourceApp,
  sourceReference: string,
): string {
  const digest = createHash("sha256")
    .update(`${IDEMPOTENCY_DOMAIN}\0${sourceApp}\0${sourceReference}`, "utf8")
    .digest("base64url");

  // "tkb1_" + 43 base64url chars = 48 chars, inside Facturations' 16–80 contract.
  return `tkb1_${digest}`;
}

/** Canonical JSON with a fixed key order, so equal drafts hash equally. */
export function canonicalInvoiceDraftJson(draft: InvoiceDraftInput): string {
  return JSON.stringify({
    currency: draft.currency,
    customer: {
      name: draft.customer.name,
      email: draft.customer.email,
      address: draft.customer.address,
    },
    invoiceDate: draft.invoiceDate,
    dueDate: draft.dueDate,
    notes: draft.notes,
    lines: draft.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      discountCents: line.discountCents,
      taxable: line.taxable,
    })),
    taxes: draft.taxes.map((tax) => ({
      code: tax.code,
      label: tax.label,
      rateMilliPercent: tax.rateMilliPercent,
    })),
  });
}

export function hashInvoiceDraft(draft: InvoiceDraftInput): string {
  return createHash("sha256")
    .update(`${PAYLOAD_DOMAIN}\0${canonicalInvoiceDraftJson(draft)}`, "utf8")
    .digest("hex");
}
