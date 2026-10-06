import "server-only";

// GROUPE TAKATAK Billing — invoices GROUPE TAKATAK sent to one client
// workspace. Read-only. Stripe customer ids come only from this workspace's
// own subscription rows; nothing from the request can choose a customer.

import { getStripeSecretKey } from "@/lib/billing/social/stripe-env";
import { getStripe } from "@/lib/billing/social/stripe-client";
import { getPrisma } from "@/lib/db/prisma";

import { mapStripeInvoice, type ClientInvoiceView } from "./invoice-view";

export type ClientInvoicesResult =
  | { status: "ok"; invoices: ClientInvoiceView[]; partial: boolean }
  | { status: "no_billing_account" }
  | { status: "unavailable" };

const STRIPE_CUSTOMER_PATTERN = /^cus_[A-Za-z0-9]{6,64}$/;
const INVOICES_PER_CUSTOMER = 24;

export async function getClientStripeCustomerIds(clientId: string): Promise<string[]> {
  const prisma = getPrisma();

  if (!prisma) {
    return [];
  }

  const [social, ads] = await Promise.all([
    prisma.clientSubscription.findUnique({
      where: { clientId },
      select: { externalCustomerId: true },
    }),
    prisma.adSubscription.findUnique({
      where: { clientId },
      select: { externalCustomerId: true },
    }),
  ]);

  return [...new Set([social?.externalCustomerId, ads?.externalCustomerId])]
    .filter((value): value is string => typeof value === "string" && STRIPE_CUSTOMER_PATTERN.test(value));
}

export async function getClientInvoices(clientId: string): Promise<ClientInvoicesResult> {
  let customerIds: string[];

  try {
    customerIds = await getClientStripeCustomerIds(clientId);
  } catch {
    return { status: "unavailable" };
  }

  if (customerIds.length === 0) {
    return { status: "no_billing_account" };
  }

  if (!getStripeSecretKey()) {
    return { status: "unavailable" };
  }

  const stripe = getStripe();
  const now = new Date();
  const results = await Promise.allSettled(
    customerIds.map((customer) =>
      stripe.invoices.list({ customer, limit: INVOICES_PER_CUSTOMER }),
    ),
  );
  const invoices: ClientInvoiceView[] = [];
  let failures = 0;

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      failures += 1;
      return;
    }

    for (const invoice of result.value.data) {
      // Defence in depth: only invoices of this workspace's own customer.
      const owner = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

      if (owner !== customerIds[index]) {
        continue;
      }

      const view = mapStripeInvoice(invoice, now);

      if (view) {
        invoices.push(view);
      }
    }
  });

  if (failures === results.length) {
    return { status: "unavailable" };
  }

  invoices.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  return { status: "ok", invoices, partial: failures > 0 };
}
