import {
  NextRequest,
  NextResponse,
} from "next/server";

import { isStripeInvoiceId, parseClientInvoiceAction } from "@/lib/billing/client-invoicing/invoice-actions";
import { applyClientInvoiceAction } from "@/lib/billing/client-invoicing/invoice-service";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Client invoicing — remind, void or mark paid (offline) one invoice of the
// workspace's own connected Stripe account. The account comes from the
// workspace's stored link, never from the request.
export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      invoiceId: string;
    }>;
  },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("manage_settings");

  if (!gate.ok) {
    return gate.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return jsonResponse({ ok: false, message: body.message }, body.status);
  }

  const { invoiceId } = await context.params;

  if (!isStripeInvoiceId(invoiceId)) {
    return jsonResponse({ ok: false, message: "Facture introuvable." }, 404);
  }

  const parsed = parseClientInvoiceAction(body.body);

  if (!parsed.ok) {
    return jsonResponse({ ok: false, message: parsed.message }, 400);
  }

  try {
    const invoice = await applyClientInvoiceAction({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      invoiceId,
      action: parsed.action,
    });

    return jsonResponse({ ok: true, invoice: { id: invoice.id, status: invoice.status } }, 200);
  } catch (error) {
    return handleApiError(
      "billing-client-invoicing-invoice-action",
      error,
      "L’action n’a pas pu être effectuée.",
    );
  }
}
