import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getFacturationsActorForAdmin } from "@/lib/billing/invoices/facturations-overview";
import { submitInvoiceRequest } from "@/lib/billing/invoices/invoice-request-service";
import { isUuid } from "@/lib/validation/common";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";
import { hasValidWriteOrigin } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GROUPE TAKATAK Billing — send one queued request to Facturations as a
// DRAFT. Platform OWNER only. Creates no issued invoice, email or payment.
export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      requestId: string;
    }>;
  },
): Promise<NextResponse> {
  const access = await requirePlatformAdminApiAccess();

  if (!access.ok) {
    return access.response;
  }

  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      {
        ok: false,
        message: "The request origin could not be verified.",
      },
      403,
    );
  }

  const { requestId } = await context.params;

  if (!isUuid(requestId)) {
    return jsonResponse(
      {
        ok: false,
        message: "Invoice request not found.",
      },
      404,
    );
  }

  try {
    const actor = await getFacturationsActorForAdmin({
      profileId: access.profileId,
      role: access.role,
    });

    if (!actor || actor.role !== "OWNER") {
      return jsonResponse(
        {
          ok: false,
          message:
            "Only the TAKATAK platform owner can send invoice requests to Facturations.",
        },
        403,
      );
    }

    const result = await submitInvoiceRequest(requestId, {
      profileId: access.profileId,
      actor,
    });

    if (result.outcome === "submitted") {
      return jsonResponse({ ok: true, request: result.request }, 200);
    }

    const message =
      result.request.status === "failed"
        ? "Facturations did not confirm the draft. Sending again is safe and cannot create a duplicate."
        : result.request.status === "pending"
          ? "The Facturations connection is not ready (configuration or access). The request stays queued."
          : result.request.status === "needs_reconciliation"
            ? "Facturations already has a draft for this request. Link it to finish."
            : "Facturations rejected the draft. Review the request.";

    return jsonResponse(
      {
        ok: false,
        message,
        code: result.code,
        retryable: result.retryable,
        request: result.request,
      },
      502,
    );
  } catch (error) {
    return handleApiError(
      "billing-invoice-requests-submit",
      error,
      "The invoice request could not be sent.",
    );
  }
}
