import { NextRequest } from "next/server";

import { validateSocialStripeCheckoutInput } from "@/lib/billing/social/stripe-checkout-policy";
import { startSocialStripeCheckout } from "@/lib/billing/social/stripe-service";
import { originFromRequest } from "@/lib/config/app-origin";
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

  const validation = validateSocialStripeCheckoutInput(bodyResult.body);

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
    const result = await startSocialStripeCheckout({
      clientId: gate.access.activeClientId,
      planCode: validation.data.planCode,
      billingCycle: validation.data.billingCycle,
      requestOrigin: originFromRequest(request),
    });

    if ("url" in result) {
      return jsonResponse(
        {
          ok: true,
          url: result.url,
        },
        200,
      );
    }

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
      "billing-stripe-checkout",
      error,
      "Stripe checkout could not be started.",
    );
  }
}
