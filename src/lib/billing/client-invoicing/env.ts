// Client invoicing — feature gate. Off unless explicitly enabled AND the
// platform Stripe key exists. Presence only; never returns secret values.

import { getStripeSecretKey } from "@/lib/billing/social/stripe-env";

export function isClientInvoicingEnabled(): boolean {
  return process.env.CLIENT_INVOICING_ENABLED?.trim() === "1" && Boolean(getStripeSecretKey());
}

/** Signing secret of the Stripe Connect webhook endpoint ("Connected accounts" events). */
export function getClientConnectWebhookSecret(): string {
  return process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() ?? "";
}
