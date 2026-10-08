import {
  NextRequest,
  NextResponse,
} from "next/server";

import { startFacturationsInvoiceCheckout } from "@/lib/billing/client-invoices/facturations-checkout";
import { originFromRequest } from "@/lib/config/app-origin";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { hasValidWriteOrigin } from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GROUPE TAKATAK Billing — open Stripe Checkout for one Facturations invoice
// of the active workspace. The body is ignored: amount and invoice come from
// Facturations for this workspace's own billing request.
export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      requestId: string;
    }>;
  },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("manage_settings");

  if (!gate.ok) {
    return gate.response;
  }

  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const { requestId } = await context.params;

  if (!isUuid(requestId)) {
    return jsonResponse({ ok: false, message: "Facture introuvable." }, 404);
  }

  try {
    const result = await startFacturationsInvoiceCheckout({
      clientId: gate.access.activeClientId,
      requestId,
      requestOrigin: originFromRequest(request),
    });

    return jsonResponse({ ok: true, url: result.url }, 200);
  } catch (error) {
    return handleApiError(
      "billing-client-invoice-checkout",
      error,
      "Le paiement n’a pas pu être ouvert.",
    );
  }
}
