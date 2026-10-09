import {
  NextRequest,
  NextResponse,
} from "next/server";

import { parseLeadOrderBillingBody } from "@/lib/billing/invoices/lead-order-draft";
import { createInvoiceRequestFromLeadOrder } from "@/lib/billing/invoices/lead-order-service";
import { isLeadId } from "@/lib/leads/lead-id";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GROUPE TAKATAK Billing — queue the invoice for a won takatak.ca order lead
// (TK-027). Lines and prices come from the order stored on the lead; the body
// only carries the explicit taxes and the payment term.
export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      leadId: string;
    }>;
  },
): Promise<NextResponse> {
  const access = await requirePlatformAdminApiAccess();

  if (!access.ok) {
    return access.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return jsonResponse({ ok: false, message: body.message }, body.status);
  }

  const { leadId } = await context.params;

  if (!isLeadId(leadId)) {
    return jsonResponse({ ok: false, message: "Lead not found." }, 404);
  }

  const parsed = parseLeadOrderBillingBody(body.body);

  if (!parsed.ok) {
    return jsonResponse({ ok: false, message: parsed.message }, 400);
  }

  try {
    const result = await createInvoiceRequestFromLeadOrder({
      leadId,
      profileId: access.profileId,
      taxes: parsed.taxes,
      dueInDays: parsed.dueInDays,
    });

    return jsonResponse({ ok: true, created: result.created, request: result.request }, result.created ? 201 : 200);
  } catch (error) {
    return handleApiError(
      "billing-lead-order-invoice",
      error,
      "The invoice request could not be created.",
    );
  }
}
