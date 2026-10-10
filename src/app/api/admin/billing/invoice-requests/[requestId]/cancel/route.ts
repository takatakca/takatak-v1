import {
  NextRequest,
  NextResponse,
} from "next/server";

import { cancelInvoiceRequest } from "@/lib/billing/invoices/invoice-request-service";
import { isUuid } from "@/lib/validation/common";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";
import { hasValidWriteOrigin } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GROUPE TAKATAK Billing — cancel a queued request that never became a draft.
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
    const cancelled = await cancelInvoiceRequest(
      requestId,
      access.profileId,
    );

    return jsonResponse({ ok: true, request: cancelled }, 200);
  } catch (error) {
    return handleApiError(
      "billing-invoice-requests-cancel",
      error,
      "The invoice request could not be cancelled.",
    );
  }
}
