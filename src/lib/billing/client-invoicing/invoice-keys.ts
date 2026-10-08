// Client invoicing — Stripe idempotency keys for invoice writes.
// Stable per (workspace, form reference, step): resubmitting the same form
// never creates a second customer, tax rate, invoice or line on the client's
// connected account.

import { createHash } from "node:crypto";

export function clientInvoiceIdempotencyKey(clientId: string, reference: string, step: string): string {
  const digest = createHash("sha256").update(["tkcinv1", clientId, reference.toLowerCase(), step].join("|")).digest("base64url");

  return `tkcinv1_${digest}`;
}

/**
 * Hash of the validated invoice contents. Part of every key, so correcting a
 * form and resubmitting it under the same reference is a new invoice instead
 * of a Stripe idempotency error over changed parameters.
 */
export function clientInvoiceContentHash(input: unknown): string {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]))
        : value;

  return createHash("sha256").update(JSON.stringify(canonical(input))).digest("base64url").slice(0, 22);
}

