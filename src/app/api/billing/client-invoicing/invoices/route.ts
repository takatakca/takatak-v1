import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createAndSendClientInvoice } from "@/lib/billing/client-invoicing/invoice-service";
import { validateClientInvoiceInput } from "@/lib/billing/client-invoicing/invoice-input";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Client invoicing — create and send an invoice to the workspace's own
// customer from its own connected Stripe account.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("manage_settings");

  if (!gate.ok) {
    return gate.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return jsonResponse({ ok: false, message: body.message }, body.status);
  }

  const validation = validateClientInvoiceInput(body.body);

  if (!validation.ok) {
    return jsonResponse({ ok: false, message: validation.errors[0], errors: validation.errors }, 400);
  }

  try {
    const result = await createAndSendClientInvoice({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      invoice: validation.value,
    });

    return jsonResponse({ ok: true, invoice: result }, 200);
  } catch (error) {
    return handleApiError(
      "billing-client-invoicing-invoices",
      error,
      "La facture n’a pas pu être envoyée.",
    );
  }
}
