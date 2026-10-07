import "server-only";

// Client invoicing — create, send and list invoices a client workspace sends
// to ITS OWN customers, on its own connected Stripe account. The account id
// always comes from this workspace's stored link, never from the request.
// Every write carries a key derived from (workspace, form reference, step),
// so a retried or double-submitted form never duplicates anything.

import Stripe from "stripe";

import { mapStripeInvoice, type ClientInvoiceView } from "@/lib/billing/client-invoices/invoice-view";
import { getStripe } from "@/lib/billing/social/stripe-client";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

import { clientConnectState } from "./connect-policy";
import { isClientInvoicingEnabled } from "./env";
import { stripePercentage, type ClientInvoiceInput } from "./invoice-input";
import { clientInvoiceContentHash, clientInvoiceIdempotencyKey } from "./invoice-keys";

const INVOICE_LIST_LIMIT = 24;

async function requireActiveAccount(clientId: string): Promise<string> {
  if (!isClientInvoicingEnabled()) {
    throw new ServiceError("unavailable", "La facturation de vos clients n’est pas encore ouverte.");
  }

  const prisma = getPrisma();
  const row = prisma ? await prisma.clientStripeConnectAccount.findUnique({ where: { clientId } }) : null;

  if (!row || clientConnectState(row) !== "active") {
    throw new ServiceError("conflict", "Connectez et activez d’abord votre compte Stripe.");
  }

  return row.stripeAccountId;
}

async function findOrCreateCustomer(
  stripe: Stripe,
  stripeAccount: string,
  clientId: string,
  input: ClientInvoiceInput,
): Promise<string> {
  const existing = await stripe.customers.list({ email: input.customer.email, limit: 10 }, { stripeAccount });
  const match = existing.data.find((customer) => customer.email?.toLowerCase() === input.customer.email);

  if (match) {
    return match.id;
  }

  const created = await stripe.customers.create(
    { name: input.customer.name, email: input.customer.email, metadata: { takatak_client_id: clientId } },
    { stripeAccount, idempotencyKey: clientInvoiceIdempotencyKey(clientId, input.reference, `customer:${clientInvoiceContentHash(input.customer)}`) },
  );

  return created.id;
}

async function resolveTaxRates(
  stripe: Stripe,
  stripeAccount: string,
  clientId: string,
  input: ClientInvoiceInput,
): Promise<string[]> {
  if (input.taxRates.length === 0) {
    return [];
  }

  const active = await stripe.taxRates.list({ active: true, limit: 100 }, { stripeAccount });

  return Promise.all(
    input.taxRates.map(async (tax) => {
      const percentage = stripePercentage(tax.percentMilli);
      const match = active.data.find(
        (rate) =>
          rate.display_name.toLowerCase() === tax.displayName.toLowerCase() &&
          Math.abs(rate.percentage - percentage) < 0.0005 &&
          rate.inclusive === false,
      );

      if (match) {
        return match.id;
      }

      const created = await stripe.taxRates.create(
        { display_name: tax.displayName, percentage, inclusive: false, metadata: { takatak_client_id: clientId } },
        { stripeAccount, idempotencyKey: clientInvoiceIdempotencyKey(clientId, input.reference, `tax:${tax.displayName.toLowerCase()}:${tax.percentMilli}`) },
      );

      return created.id;
    }),
  );
}

export async function createAndSendClientInvoice(input: {
  clientId: string;
  profileId: string;
  invoice: ClientInvoiceInput;
}): Promise<{ invoiceId: string; number: string | null; hostedUrl: string | null }> {
  const stripeAccount = await requireActiveAccount(input.clientId);
  const stripe = getStripe();
  const contentHash = clientInvoiceContentHash(input.invoice);
  const key = (step: string) => clientInvoiceIdempotencyKey(input.clientId, input.invoice.reference, `${contentHash}:${step}`);
  const customer = await findOrCreateCustomer(stripe, stripeAccount, input.clientId, input.invoice);
  const taxRateIds = await resolveTaxRates(stripe, stripeAccount, input.clientId, input.invoice);
  const metadata = {
    takatak_client_id: input.clientId,
    takatak_reference: input.invoice.reference,
    takatak_created_by: input.profileId,
  };

  const draft = await stripe.invoices.create(
    {
      customer,
      currency: "cad",
      collection_method: "send_invoice",
      days_until_due: input.invoice.daysUntilDue,
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      ...(taxRateIds.length > 0 ? { default_tax_rates: taxRateIds } : {}),
      ...(input.invoice.memo ? { description: input.invoice.memo } : {}),
      metadata,
    },
    { stripeAccount, idempotencyKey: key("invoice") },
  );

  if (!draft.id || draft.customer !== customer) {
    throw new ServiceError("unavailable", "Stripe n’a pas créé la facture attendue.");
  }

  for (const [index, line] of input.invoice.lines.entries()) {
    await stripe.invoiceItems.create(
      {
        customer,
        invoice: draft.id,
        currency: "cad",
        description: line.description,
        quantity: line.quantity,
        unit_amount_decimal: Stripe.Decimal.from(String(line.unitAmountCents)),
        metadata: { takatak_reference: input.invoice.reference, takatak_line: String(index + 1) },
      },
      { stripeAccount, idempotencyKey: key(`line:${index + 1}`) },
    );
  }

  const finalized = draft.status === "draft"
    ? await stripe.invoices.finalizeInvoice(draft.id, { auto_advance: false }, { stripeAccount, idempotencyKey: key("finalize") })
    : draft;
  const sent = finalized.status === "open"
    ? await stripe.invoices.sendInvoice(finalized.id as string, {}, { stripeAccount, idempotencyKey: key("send") })
    : finalized;

  return {
    invoiceId: sent.id as string,
    number: sent.number ?? null,
    hostedUrl: mapStripeInvoice(sent as never)?.payUrl ?? null,
  };
}

export type ClientIssuedInvoicesResult =
  | { status: "ok"; invoices: ClientInvoiceView[] }
  | { status: "not_active" }
  | { status: "unavailable" };

/** Finalized invoices on this workspace's own connected account. */
export async function listClientIssuedInvoices(clientId: string): Promise<ClientIssuedInvoicesResult> {
  let stripeAccount: string;

  try {
    stripeAccount = await requireActiveAccount(clientId);
  } catch {
    return { status: "not_active" };
  }

  try {
    const now = new Date();
    const page = await getStripe().invoices.list({ limit: INVOICE_LIST_LIMIT }, { stripeAccount });
    const invoices = page.data
      .map((invoice) => mapStripeInvoice(invoice, now))
      .filter((view): view is ClientInvoiceView => view !== null);

    return { status: "ok", invoices };
  } catch {
    return { status: "unavailable" };
  }
}
