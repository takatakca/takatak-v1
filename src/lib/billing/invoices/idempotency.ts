// GROUPE TAKATAK Billing — deterministic idempotency and payload hashing.
// Pure module (node:crypto only).
//
// Each queued request gets exactly one Facturations Idempotency-Key, derived
// from its own row id. Every retry of that request reuses the key, so
// Facturations returns the same draft instead of creating a duplicate.
// Duplicate *requests* are prevented separately by the unique
// (sourceApp, sourceReference) pair. Using the row id (not the reference)
// means two TAKATAK installs (production, staging, a restored copy) can
// never collide on the same key in one Facturations business.

import { createHash } from "node:crypto";

import type { InvoiceDraftInput } from "./draft-input";

const IDEMPOTENCY_DOMAIN = "takatak-billing-facturations-idempotency-v1";
const PAYLOAD_DOMAIN = "takatak-billing-invoice-request-v1";

export const FACTURATIONS_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function deriveFacturationsIdempotencyKey(requestId: string): string {
  if (!UUID_PATTERN.test(requestId)) {
    throw new TypeError("Invoice request id must be a UUID.");
  }

  const digest = createHash("sha256")
    .update(`${IDEMPOTENCY_DOMAIN}\0${requestId.toLowerCase()}`, "utf8")
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
