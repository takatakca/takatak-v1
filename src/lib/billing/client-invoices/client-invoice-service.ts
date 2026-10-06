import "server-only";

// GROUPE TAKATAK Billing — invoices GROUPE TAKATAK sent to one client
// workspace. Read-only. Two sources, both bound to this workspace by its own
// rows; nothing from the request can choose a customer or an invoice:
//   - Stripe: subscription invoices of the workspace's Stripe customers;
//   - Facturations: invoices issued from this workspace's billing requests
//     (explicit draft-id link recorded by TAKATAK, never email matching).

import { getStripeSecretKey } from "@/lib/billing/social/stripe-env";
import { getStripe } from "@/lib/billing/social/stripe-client";
import { getPrisma } from "@/lib/db/prisma";
import { getFacturationsDraftIssuance } from "@/lib/integrations/facturations/client";
import { getFacturationsEnvStatus } from "@/lib/integrations/facturations/env";
import { FACTURATIONS_CLIENT_INVOICE_READER } from "@/lib/integrations/facturations/identity";

import { mapFacturationsInvoice, mapStripeInvoice, type ClientInvoiceView } from "./invoice-view";

export type ClientInvoicesResult =
  | { status: "ok"; invoices: ClientInvoiceView[]; partial: boolean }
  | { status: "no_billing_account" }
  | { status: "unavailable" };

const STRIPE_CUSTOMER_PATTERN = /^cus_[A-Za-z0-9]{6,64}$/;
const INVOICES_PER_CUSTOMER = 24;
const FACTURATIONS_REQUESTS_LIMIT = 50;
const FACTURATIONS_CONCURRENCY = 5;

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

async function getStripeInvoices(
  customerIds: string[],
  now: Date,
): Promise<{ invoices: ClientInvoiceView[]; failed: boolean; attempted: boolean }> {
  if (customerIds.length === 0) {
    return { invoices: [], failed: false, attempted: false };
  }

  if (!getStripeSecretKey()) {
    return { invoices: [], failed: true, attempted: true };
  }

  const stripe = getStripe();
  const results = await Promise.allSettled(
    customerIds.map((customer) =>
      stripe.invoices.list({ customer, limit: INVOICES_PER_CUSTOMER }),
    ),
  );
  const invoices: ClientInvoiceView[] = [];
  let failed = false;

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      failed = true;
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

  return { invoices, failed, attempted: true };
}

function draftField(draft: unknown, key: "dueDate" | "notes"): string | null {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return null;
  }

  const value = (draft as Record<string, unknown>)[key];

  return typeof value === "string" ? value : null;
}

function firstLineDescription(draft: unknown): string | null {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return null;
  }

  const lines = (draft as Record<string, unknown>).lines;

  if (!Array.isArray(lines) || lines.length === 0) {
    return null;
  }

  const first = lines[0] as Record<string, unknown>;
  const description = typeof first?.description === "string" ? first.description : null;

  return description && lines.length > 1 ? `${description} (+${lines.length - 1})` : description;
}

async function getFacturationsInvoices(
  clientId: string,
  now: Date,
): Promise<{ invoices: ClientInvoiceView[]; failed: boolean; attempted: boolean }> {
  const env = getFacturationsEnvStatus();
  const prisma = getPrisma();

  if (!env.enabled || !env.configured || !prisma) {
    return { invoices: [], failed: false, attempted: false };
  }

  const requests = await prisma.billingInvoiceRequest.findMany({
    where: { clientId, status: "submitted", facturationsDraftId: { not: null } },
    orderBy: { submittedAt: "desc" },
    take: FACTURATIONS_REQUESTS_LIMIT,
    select: { id: true, facturationsDraftId: true, draft: true },
  });

  if (requests.length === 0) {
    return { invoices: [], failed: false, attempted: false };
  }

  const invoices: ClientInvoiceView[] = [];
  const checkoutAvailable = Boolean(getStripeSecretKey());
  let failed = false;

  for (let start = 0; start < requests.length; start += FACTURATIONS_CONCURRENCY) {
    const batch = requests.slice(start, start + FACTURATIONS_CONCURRENCY);
    const results = await Promise.all(
      batch.map((request) =>
        getFacturationsDraftIssuance(FACTURATIONS_CLIENT_INVOICE_READER, request.facturationsDraftId as string),
      ),
    );

    results.forEach((result, index) => {
      if (!result.ok) {
        failed = true;
        return;
      }

      const request = batch[index];

      // The draft id was recorded by TAKATAK for THIS workspace's request;
      // Facturations must answer for that exact draft.
      if (!result.data.issued || !result.data.invoice || result.data.draftId !== request.facturationsDraftId) {
        return;
      }

      const view = mapFacturationsInvoice(
        {
          requestId: request.id,
          invoice: result.data.invoice,
          dueDate: draftField(request.draft, "dueDate"),
          description: firstLineDescription(request.draft),
        },
        now,
      );

      invoices.push(checkoutAvailable ? view : { ...view, checkoutRequestId: null });
    });
  }

  return { invoices, failed, attempted: true };
}

export async function getClientInvoices(clientId: string): Promise<ClientInvoicesResult> {
  let customerIds: string[];

  try {
    customerIds = await getClientStripeCustomerIds(clientId);
  } catch {
    return { status: "unavailable" };
  }

  const now = new Date();
  const [stripe, facturations] = await Promise.all([
    getStripeInvoices(customerIds, now),
    getFacturationsInvoices(clientId, now).catch(() => ({ invoices: [], failed: true, attempted: true })),
  ]);

  if (!stripe.attempted && !facturations.attempted) {
    return { status: "no_billing_account" };
  }

  const invoices = [...stripe.invoices, ...facturations.invoices];
  const everyAttemptFailed =
    (!stripe.attempted || stripe.failed) &&
    (!facturations.attempted || facturations.failed) &&
    invoices.length === 0;

  if (everyAttemptFailed) {
    return { status: "unavailable" };
  }

  invoices.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  return { status: "ok", invoices, partial: stripe.failed || facturations.failed };
}
