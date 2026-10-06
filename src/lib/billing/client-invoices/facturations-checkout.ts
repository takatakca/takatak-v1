import "server-only";

// GROUPE TAKATAK Billing — "Payer" for a Facturations-issued invoice.
// The workspace can only pay invoices issued from its OWN billing requests;
// the amount and invoice id come from Facturations, never from the browser.
// TAKATAK never marks the invoice paid: Facturations does, from the
// Stripe-signed webhook, and the client center reads it back.

import { getClientStripeCustomerIds } from "@/lib/billing/client-invoices/client-invoice-service";
import { mapFacturationsInvoice } from "@/lib/billing/client-invoices/invoice-view";
import { getStripeSecretKey } from "@/lib/billing/social/stripe-env";
import { getStripe } from "@/lib/billing/social/stripe-client";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getPrisma } from "@/lib/db/prisma";
import { getFacturationsDraftIssuance } from "@/lib/integrations/facturations/client";
import { getFacturationsConfig } from "@/lib/integrations/facturations/env";
import { FACTURATIONS_CLIENT_INVOICE_READER } from "@/lib/integrations/facturations/identity";
import { ServiceError } from "@/lib/services/service-error";

import {
  buildFacturationsCheckoutParams,
  decidePreviousCheckoutSession,
  facturationsCheckoutIdempotencyKey,
  hashCheckoutParams,
  isPayableFacturationsAmount,
  safeCheckoutUrl,
} from "./facturations-checkout-policy";

export async function startFacturationsInvoiceCheckout(input: {
  clientId: string;
  requestId: string;
  requestOrigin?: string | null;
}): Promise<{ url: string }> {
  const config = getFacturationsConfig();
  const prisma = getPrisma();

  if (!config || !prisma || !getStripeSecretKey()) {
    throw new ServiceError("unavailable", "Le paiement en ligne n’est pas encore disponible.");
  }

  const request = await prisma.billingInvoiceRequest.findFirst({
    where: { id: input.requestId, clientId: input.clientId, status: "submitted", facturationsDraftId: { not: null } },
    select: { id: true, facturationsDraftId: true, draft: true },
  });

  if (!request?.facturationsDraftId) {
    throw new ServiceError("not_found", "Facture introuvable.");
  }

  const issuance = await getFacturationsDraftIssuance(FACTURATIONS_CLIENT_INVOICE_READER, request.facturationsDraftId);

  if (!issuance.ok) {
    throw new ServiceError("unavailable", "La facture est temporairement indisponible. Réessayez dans quelques minutes.");
  }

  if (!issuance.data.issued || !issuance.data.invoice || issuance.data.draftId !== request.facturationsDraftId) {
    throw new ServiceError("not_found", "Facture introuvable.");
  }

  const invoice = issuance.data.invoice;
  const view = mapFacturationsInvoice({ requestId: request.id, invoice, dueDate: null, description: null });

  if (!view.checkoutRequestId || !isPayableFacturationsAmount(view.amountDueMinor)) {
    throw new ServiceError("conflict", "Cette facture n’a pas de solde à payer en ligne.");
  }

  const amountCents = view.amountDueMinor;
  const stripe = getStripe();
  const previous = await prisma.billingInvoiceCheckoutSession.findFirst({
    where: { requestId: request.id, clientId: input.clientId },
    orderBy: { createdAt: "desc" },
  });

  if (previous) {
    const session = await stripe.checkout.sessions.retrieve(previous.stripeSessionId);
    const decision = decidePreviousCheckoutSession({
      status: session.status,
      paymentStatus: session.payment_status,
      sessionAmountCents: session.amount_total,
      currentAmountCents: amountCents,
    });

    if (decision === "reuse") {
      const url = safeCheckoutUrl(session.url);
      if (url) {
        return { url };
      }
    }

    if (decision === "refuse_processing") {
      throw new ServiceError("conflict", "Un paiement est déjà en cours de traitement pour cette facture.");
    }

    if (decision === "refuse_paid") {
      throw new ServiceError(
        "conflict",
        "Ce paiement a déjà été reçu. La facture sera marquée payée dès la confirmation de Stripe.",
      );
    }

    if (session.status === "open") {
      // Outdated amount: close it so it can never be paid alongside the new one.
      await stripe.checkout.sessions.expire(previous.stripeSessionId);
    }
  }

  const [customerId] = await getClientStripeCustomerIds(input.clientId);
  const params = buildFacturationsCheckoutParams({
    businessId: config.businessId,
    issuedInvoiceId: invoice.id,
    invoiceNumber: invoice.officialInvoiceNumber,
    amountCents,
    clientId: input.clientId,
    requestId: request.id,
    customerId: customerId ?? null,
    origin: getApplicationOrigin(input.requestOrigin),
  });
  // Same click twice → same key → same session. The key also covers the exact
  // parameters and the previous session, so it never collides after a change.
  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: facturationsCheckoutIdempotencyKey({
      clientId: input.clientId,
      issuedInvoiceId: invoice.id,
      amountCents,
      attempt: `${previous?.stripeSessionId ?? "first"}|${hashCheckoutParams(params)}`,
    }),
  });
  const url = session.status === "open" ? safeCheckoutUrl(session.url) : null;

  if (!url || typeof session.id !== "string") {
    throw new ServiceError("unavailable", "Stripe n’a pas ouvert la page de paiement. Réessayez dans quelques minutes.");
  }

  await prisma.billingInvoiceCheckoutSession.createMany({
    data: [{
      requestId: request.id,
      clientId: input.clientId,
      issuedInvoiceId: invoice.id,
      stripeSessionId: session.id,
      amountCents: BigInt(amountCents),
    }],
    skipDuplicates: true,
  });

  return { url };
}
