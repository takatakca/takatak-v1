import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";

import { validateBillingInfoInput } from "@/lib/billing/social/billing-info-validation";
import { getPrisma } from "@/lib/db/prisma";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
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

  const validation = validateBillingInfoInput(bodyResult.body);

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

  const prisma = getPrisma();

  if (!prisma) {
    return jsonResponse(
      { ok: false, message: "Billing information could not be saved." },
      503,
    );
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.client.update({
        where: { id: gate.access.activeClientId },
        data: {
          companyName: validation.data.companyName,
          vatTaxId: validation.data.vatTaxId,
          billingAddress: validation.data.billingAddress,
          billingCountry: validation.data.billingCountry,
          invoiceEmails: validation.data.invoiceEmails,
        },
      });

      await transaction.auditLog.create({
        data: {
          profileId: gate.access.profileId,
          clientId: gate.access.activeClientId,
          action: "billing_information_updated",
          entityType: "Client",
          entityId: gate.access.activeClientId,
          metadata: {
            note: "Workspace billing information was updated.",
          },
        },
      });
    });

    revalidatePath("/dashboard/social/settings");
    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard/billing");

    return jsonResponse(
      { ok: true, message: "Billing information was saved." },
      200,
    );
  } catch (error) {
    return handleApiError(
      "billing-info",
      error,
      "Billing information could not be saved.",
    );
  }
}
