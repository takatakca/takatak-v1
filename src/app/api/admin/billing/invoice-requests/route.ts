import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  enqueueInvoiceRequest,
  listInvoiceRequests,
} from "@/lib/billing/invoices/invoice-request-service";
import {
  INVOICE_REQUEST_STATUSES,
  validateInvoiceRequestCreate,
  type InvoiceRequestStatus,
} from "@/lib/billing/invoices/request-policy";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GROUPE TAKATAK Billing — central invoice request queue (platform admin).
export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const access = await requirePlatformAdminApiAccess();

  if (!access.ok) {
    return access.response;
  }

  const statusParam = request.nextUrl.searchParams.get("status");
  const status = INVOICE_REQUEST_STATUSES.includes(
    statusParam as InvoiceRequestStatus,
  )
    ? (statusParam as InvoiceRequestStatus)
    : undefined;

  try {
    const requests = await listInvoiceRequests({ status });

    return jsonResponse({ ok: true, requests }, 200);
  } catch (error) {
    return handleApiError(
      "billing-invoice-requests-list",
      error,
      "Invoice requests are unavailable.",
    );
  }
}

// Manual requests entered by a TAKATAK admin. Ecosystem apps feed the queue
// from their own server code through enqueueInvoiceRequest().
export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const access = await requirePlatformAdminApiAccess();

  if (!access.ok) {
    return access.response;
  }

  const bodyResult = await readJsonBody(request);

  if (!bodyResult.ok) {
    return jsonResponse(
      {
        ok: false,
        message: bodyResult.message,
      },
      bodyResult.status,
    );
  }

  const validation = validateInvoiceRequestCreate(bodyResult.body, {
    allowedSourceApps: ["manual"],
  });

  if (!validation.success) {
    return jsonResponse(
      {
        ok: false,
        message: validation.message,
        fieldErrors: validation.fieldErrors,
      },
      400,
    );
  }

  try {
    const result = await enqueueInvoiceRequest(validation.data, {
      profileId: access.profileId,
    });

    return jsonResponse(
      {
        ok: true,
        created: result.created,
        request: result.request,
      },
      result.created ? 201 : 200,
    );
  } catch (error) {
    return handleApiError(
      "billing-invoice-requests-create",
      error,
      "The invoice request could not be saved.",
    );
  }
}
