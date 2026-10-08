import "server-only";

// GROUPE TAKATAK Billing — turn a won takatak.ca order lead into one invoice
// request in the central billing queue (TK-027). Platform owner/admin only,
// like the queue itself. Idempotent: the source reference is derived from
// the lead, so a repeated click returns the same request.

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { referenceFor } from "@/lib/website-leads/store";

import type { InvoiceTaxInput } from "./draft-input";
import { enqueueInvoiceRequest, toInvoiceRequestView, type InvoiceRequestView } from "./invoice-request-service";
import {
  buildLeadOrderDraft,
  LEAD_ORDER_SOURCE_APP,
  leadOrderBlockers,
  leadOrderSourceReference,
  readLeadOrder,
  type LeadOrderBlocker,
  type LeadOrderPricing,
} from "./lead-order-draft";

export interface LeadOrderBillingState {
  order: LeadOrderPricing;
  blockers: LeadOrderBlocker[];
  request: InvoiceRequestView | null;
}

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable", "The database is not available.");
  return prisma;
}

/** Null when the lead is not a takatak.ca package order. */
export async function getLeadOrderBilling(leadId: string): Promise<LeadOrderBillingState | null> {
  const prisma = requirePrisma();
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, status: true, name: true, company: true, email: true, metadata: true },
  });
  const order = lead ? readLeadOrder(lead.metadata) : null;
  if (!lead || !order) return null;

  const row = await prisma.billingInvoiceRequest.findUnique({
    where: { sourceApp_sourceReference: { sourceApp: LEAD_ORDER_SOURCE_APP, sourceReference: leadOrderSourceReference(lead.id) } },
  });

  return { order, blockers: leadOrderBlockers(lead), request: row ? toInvoiceRequestView(row) : null };
}

export async function createInvoiceRequestFromLeadOrder(input: {
  leadId: string;
  profileId: string;
  taxes: InvoiceTaxInput[];
  dueInDays: number;
  now?: Date;
}): Promise<{ request: InvoiceRequestView; created: boolean }> {
  const prisma = requirePrisma();
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { id: true, clientId: true, status: true, name: true, company: true, email: true, metadata: true },
  });

  if (!lead) throw new ServiceError("not_found", "Lead not found.");

  const order = readLeadOrder(lead.metadata);
  const blockers = leadOrderBlockers(lead);

  if (!order || blockers.includes("not_an_order")) {
    throw new ServiceError("conflict", "Only takatak.ca package orders can be billed from a lead.");
  }
  if (blockers.includes("not_won")) {
    throw new ServiceError("conflict", "Mark the lead as Won before creating its invoice.");
  }
  if (blockers.length > 0 || !lead.email) {
    throw new ServiceError("conflict", "The lead needs a customer name and email before it can be billed.");
  }

  const reference = referenceFor(lead.id);
  const draft = buildLeadOrderDraft({
    order,
    customer: { name: lead.name?.trim() || lead.company?.trim() || "", email: lead.email },
    taxes: input.taxes,
    dueInDays: input.dueInDays,
    reference,
    now: input.now,
  });

  const result = await enqueueInvoiceRequest(
    {
      sourceApp: LEAD_ORDER_SOURCE_APP,
      sourceReference: leadOrderSourceReference(lead.id),
      // A website guest has no TAKATAK workspace yet; the customer is the
      // lead's contact. The request stays in the platform queue.
      clientId: null,
      draft,
    },
    { profileId: input.profileId },
  );

  if (result.created) {
    await prisma.leadActivity.create({
      data: {
        clientId: lead.clientId,
        leadId: lead.id,
        type: "note",
        status: "completed_internal",
        title: "Invoice request created for Facturations",
        note: `Billing queue request ${result.request.id} (estimate ${(Number(result.request.estimatedTotalCents) / 100).toFixed(2)} CAD). The owner reviews it in Admin › Billing before the Facturations draft is sent.`,
        completedAt: new Date(),
        metadata: { billingInvoiceRequestId: result.request.id, sourceReference: result.request.sourceReference },
      },
    });
  }

  return result;
}
