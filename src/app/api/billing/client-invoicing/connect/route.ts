import {
  NextRequest,
  NextResponse,
} from "next/server";

import { startClientConnectOnboarding } from "@/lib/billing/client-invoicing/connect-service";
import { originFromRequest } from "@/lib/config/app-origin";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { hasValidWriteOrigin } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Client invoicing — create (once) and open onboarding for the active
// workspace's own Stripe account. The body is ignored.
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  try {
    const result = await startClientConnectOnboarding({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      requestOrigin: originFromRequest(request),
    });

    return jsonResponse({ ok: true, url: result.url }, 200);
  } catch (error) {
    return handleApiError(
      "billing-client-invoicing-connect",
      error,
      "La configuration Stripe n’a pas pu être ouverte.",
    );
  }
}
