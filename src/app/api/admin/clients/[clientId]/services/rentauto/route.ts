import { revalidatePath } from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  RENTAUTO_MANAGED_STATUSES,
  setRentautoServiceStatus,
  type RentautoManagedStatus,
} from "@/lib/admin/rentauto-service-admin";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";
import { readJsonBody } from "@/lib/security/write-request";
import { isRecord, isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isManagedStatus(
  value: unknown,
): value is RentautoManagedStatus {
  return (
    typeof value === "string" &&
    (RENTAUTO_MANAGED_STATUSES as readonly string[]).includes(value)
  );
}

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{
      clientId: string;
    }>;
  },
): Promise<NextResponse> {
  const access =
    await requirePlatformAdminApiAccess();

  if (!access.ok) {
    return access.response;
  }

  const { clientId } = await context.params;

  if (!isUuid(clientId)) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The selected workspace identifier is invalid.",
      },
      400,
    );
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

  if (!isRecord(bodyResult.body)) {
    return jsonResponse(
      {
        ok: false,
        message: "The request body must be a JSON object.",
      },
      400,
    );
  }

  const status = bodyResult.body.status;

  if (!isManagedStatus(status)) {
    return jsonResponse(
      {
        ok: false,
        message:
          "Rentauto status must be pending_setup, active, or paused.",
      },
      400,
    );
  }

  try {
    const service = await setRentautoServiceStatus({
      clientId,
      status,
      actorProfileId: access.profileId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/services");
    revalidatePath("/dashboard/rentauto");

    return jsonResponse(
      {
        ok: true,
        message: service.changed
          ? `RENTAUTO.CA access is now ${service.status} for ${service.clientName}.`
          : `RENTAUTO.CA access was already ${service.status} for ${service.clientName}.`,
        service,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "admin-rentauto-service",
      error,
      "RENTAUTO.CA access could not be updated.",
    );
  }
}
