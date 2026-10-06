// GROUPE TAKATAK Billing — Stripe Checkout for Facturations-issued invoices.
// Pure module. Builds the one-time CAD payment session whose metadata lets
// Facturations attach the verified Stripe payment to the exact issued
// invoice (POST /webhooks/stripe/payments on the Facturations side). The
// amount is always the balance Facturations reported, never client input.

import { createHash } from "node:crypto";

export const FACTURATIONS_CHECKOUT_MAX_CENTS = 99_999_999; // Stripe CAD ceiling

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STRIPE_CUSTOMER_PATTERN = /^cus_[A-Za-z0-9]{6,64}$/;
const STRIPE_CHECKOUT_HOSTS = new Set(["checkout.stripe.com"]);

export interface FacturationsCheckoutInput {
  businessId: string;
  issuedInvoiceId: string;
  invoiceNumber: string;
  amountCents: number;
  clientId: string;
  requestId: string;
  customerId: string | null;
  origin: string;
}

export interface FacturationsCheckoutParams {
  mode: "payment";
  locale: "fr-CA";
  customer?: string;
  client_reference_id: string;
  success_url: string;
  cancel_url: string;
  line_items: Array<{
    quantity: 1;
    price_data: {
      currency: "cad";
      unit_amount: number;
      product_data: { name: string };
    };
  }>;
  metadata: Record<string, string>;
  payment_intent_data: {
    description: string;
    metadata: Record<string, string>;
  };
}

export function isPayableFacturationsAmount(amountCents: number): boolean {
  return Number.isSafeInteger(amountCents) && amountCents >= 50 && amountCents <= FACTURATIONS_CHECKOUT_MAX_CENTS;
}

export function buildFacturationsCheckoutParams(input: FacturationsCheckoutInput): FacturationsCheckoutParams {
  if (!UUID_PATTERN.test(input.issuedInvoiceId) || !UUID_PATTERN.test(input.requestId)) {
    throw new TypeError("Facturations checkout requires exact invoice and request ids.");
  }

  if (!input.businessId || input.businessId.length > 200) {
    throw new TypeError("Facturations checkout requires a business id.");
  }

  if (!isPayableFacturationsAmount(input.amountCents)) {
    throw new TypeError("Facturations checkout amount is outside Stripe limits.");
  }

  const origin = new URL(input.origin).origin;
  const number = input.invoiceNumber.replace(/[^\p{L}\p{N} ._#/-]/gu, "").slice(0, 64) || "Facture";
  const metadata = {
    facturations_business_id: input.businessId,
    facturations_issued_invoice_id: input.issuedInvoiceId.toLowerCase(),
    takatak_client_id: input.clientId,
    takatak_invoice_request_id: input.requestId,
  };

  return {
    mode: "payment",
    locale: "fr-CA",
    ...(input.customerId && STRIPE_CUSTOMER_PATTERN.test(input.customerId) ? { customer: input.customerId } : {}),
    client_reference_id: input.clientId,
    success_url: `${origin}/dashboard/invoices?payment=success`,
    cancel_url: `${origin}/dashboard/invoices?payment=cancelled`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: input.amountCents,
          product_data: { name: `Facture ${number}` },
        },
      },
    ],
    metadata,
    payment_intent_data: {
      description: `GROUPE TAKATAK — Facture ${number}`,
      metadata,
    },
  };
}

/**
 * Same invoice + same balance + same workspace => same key, so a double click
 * (or two tabs) reuses one Stripe session instead of opening two payments.
 * `attempt` rotates the key once a previous session has expired.
 */
export function facturationsCheckoutIdempotencyKey(input: {
  clientId: string;
  issuedInvoiceId: string;
  amountCents: number;
  attempt?: string;
}): string {
  const digest = createHash("sha256")
    .update(["tkpay1", input.clientId, input.issuedInvoiceId.toLowerCase(), String(input.amountCents), input.attempt ?? ""].join("|"))
    .digest("base64url");

  return `tkpay1_${digest}`;
}

/** Only Stripe-hosted HTTPS Checkout pages are ever returned to a browser. */
export function safeCheckoutUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && STRIPE_CHECKOUT_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}
