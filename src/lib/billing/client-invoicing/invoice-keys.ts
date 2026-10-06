// Client invoicing — Stripe idempotency keys for invoice writes.
// Stable per (workspace, form reference, step): resubmitting the same form
// never creates a second customer, tax rate, invoice or line on the client's
// connected account.

import { createHash } from "node:crypto";

export function clientInvoiceIdempotencyKey(clientId: string, reference: string, step: string): string {
  const digest = createHash("sha256").update(["tkcinv1", clientId, reference.toLowerCase(), step].join("|")).digest("base64url");

  return `tkcinv1_${digest}`;
}
