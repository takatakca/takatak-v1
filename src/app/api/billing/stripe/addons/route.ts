import { NextRequest } from "next/server";

import { validateSocialStripeAddonInput } from "@/lib/billing/social/stripe-addon-policy";
import { startSocialStripeAddonChange } from "@/lib/billing/social/stripe-service";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("manage_settings");

  if (!gate.ok) {
    return gate.response;
  }

  const bodyResult = await readJsonBody(request);

  if (!bodyResult.ok) {
    return jsonResponse(
      { ok: false, message: bodyResult.message },
      bodyResult.status,
    );
  }

  const validation = validateSocialStripeAddonInput(bodyResult.body);

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
    const result = await startSocialStripeAddonChange({
      clientId: gate.access.activeClientId,
      addonCode: validation.data.addonCode,
      action: validation.data.action,
    });

    return jsonResponse(
      {
        ok: true,
        updated: true,
        message: result.message,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "billing-stripe-addons",
      error,
      "The add-on could not be updated.",
    );
  }
}
