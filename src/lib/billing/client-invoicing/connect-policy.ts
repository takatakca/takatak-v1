// Client invoicing — Stripe Connect policy for a client's OWN Stripe account.
// Pure module. The client owns the account (Stripe-hosted dashboard, Stripe
// collects identity requirements and is liable for losses, the client pays
// Stripe fees). Invoices the client sends to its customers live there; funds
// never pass through GROUPE TAKATAK.

import { createHash } from "node:crypto";

export const STRIPE_CONNECT_ACCOUNT_PATTERN = /^acct_[A-Za-z0-9]{6,64}$/;
export const CLIENT_BILLING_PATH = "/dashboard/client-billing";

const ONBOARDING_HOSTS = new Set(["connect.stripe.com"]);

export type ClientConnectState = "not_connected" | "onboarding" | "restricted" | "active";

export interface ClientConnectFlags {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  country: string | null;
  defaultCurrency: string | null;
}

/** Minimal structural shape of a Stripe account (subset of Stripe.Account). */
export interface StripeAccountLike {
  id: string;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  country?: string | null;
  default_currency?: string | null;
}

export function buildConnectAccountCreateParams(input: { clientId: string; email?: string | null }) {
  const email = input.email && /^[^\s@]{1,64}@[^\s@]{1,255}$/.test(input.email) ? input.email : null;

  return {
    country: "CA",
    controller: {
      stripe_dashboard: { type: "full" as const },
      fees: { payer: "account" as const },
      losses: { payments: "stripe" as const },
      requirement_collection: "stripe" as const,
    },
    metadata: { takatak_client_id: input.clientId },
    ...(email ? { email } : {}),
  };
}

export function buildAccountLinkParams(input: { accountId: string; origin: string }) {
  if (!STRIPE_CONNECT_ACCOUNT_PATTERN.test(input.accountId)) {
    throw new TypeError("A Stripe Connect account id is required.");
  }

  const origin = new URL(input.origin).origin;

  return {
    account: input.accountId,
    type: "account_onboarding" as const,
    refresh_url: `${origin}${CLIENT_BILLING_PATH}?connect=refresh`,
    return_url: `${origin}${CLIENT_BILLING_PATH}?connect=return`,
    collection_options: { fields: "eventually_due" as const },
  };
}

/** One Stripe account per workspace, even if two people click at once. */
export function connectAccountIdempotencyKey(clientId: string): string {
  return `tkconnect1_${createHash("sha256").update(`tkconnect1|${clientId}`).digest("base64url")}`;
}

export function readConnectFlags(account: StripeAccountLike): ClientConnectFlags {
  const country = typeof account.country === "string" && /^[A-Za-z]{2}$/.test(account.country)
    ? account.country.toUpperCase()
    : null;
  const currency = typeof account.default_currency === "string" && /^[A-Za-z]{3}$/.test(account.default_currency)
    ? account.default_currency.toLowerCase()
    : null;

  return {
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    detailsSubmitted: account.details_submitted === true,
    country,
    defaultCurrency: currency,
  };
}

export function clientConnectState(flags: Pick<ClientConnectFlags, "chargesEnabled" | "detailsSubmitted"> | null): ClientConnectState {
  if (!flags) {
    return "not_connected";
  }

  if (!flags.detailsSubmitted) {
    return "onboarding";
  }

  return flags.chargesEnabled ? "active" : "restricted";
}

/** Only Stripe-hosted HTTPS onboarding pages are ever returned to a browser. */
export function safeOnboardingUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && ONBOARDING_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}
