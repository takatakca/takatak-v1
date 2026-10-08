import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getFacturationsActorForAdmin } from "@/lib/billing/invoices/facturations-overview";
import { reconcileInvoiceRequest } from "@/lib/billing/invoices/invoice-request-service";
import { isFacturationsDraftId } from "@/lib/integrations/facturations/contract";
import { isRecord, isUuid } from "@/lib/validation/common";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GROUPE TAKATAK Billing — link the Facturations draft that already owns this
// request's Idempotency-Key (after a 409). Platform OWNER only; the draft is
// fetched from Facturations and must match the stored request exactly.
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

  const bodyResult = await readJsonBody(request, 1_024);

  if (!bodyResult.ok) {
    return jsonResponse(
      {
        ok: false,
        message: bodyResult.message,
      },
      bodyResult.status,
    );
  }

  const { requestId } = await context.params;
  const body = bodyResult.body;

  if (!isUuid(requestId)) {
    return jsonResponse(
      {
        ok: false,
        message: "Invoice request not found.",
      },
      404,
    );
  }

  if (
    !isRecord(body) ||
    Object.keys(body).length !== 1 ||
    !isFacturationsDraftId(body.facturationsDraftId)
  ) {
    return jsonResponse(
      {
        ok: false,
        message: "Enter the Facturations draft id (UUID).",
        fieldErrors: { facturationsDraftId: "A Facturations draft UUID is required." },
      },
      400,
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
          message: "Only the TAKATAK platform owner can link Facturations drafts.",
        },
        403,
      );
    }

    const reconciled = await reconcileInvoiceRequest(
      requestId,
      body.facturationsDraftId.toLowerCase(),
      { profileId: access.profileId, actor },
    );

    return jsonResponse({ ok: true, request: reconciled }, 200);
  } catch (error) {
    return handleApiError(
      "billing-invoice-requests-reconcile",
      error,
      "The Facturations draft could not be linked.",
    );
  }
}
