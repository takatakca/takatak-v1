import { revalidatePath } from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { updateLocation } from "@/lib/locations/location-service";
import { validateLocationInput } from "@/lib/locations/location-validation";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      locationId: string;
    }>;
  },
): Promise<NextResponse> {
  const gate =
    await requireWorkspaceApiPermission(
      "manage_brands",
    );

  if (!gate.ok) {
    return gate.response;
  }

  const { locationId } =
    await context.params;

  if (!isUuid(locationId)) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The selected location identifier is invalid.",
      },
      400,
    );
  }

  const bodyResult =
    await readJsonBody(request);

  if (!bodyResult.ok) {
    return jsonResponse(
      {
        ok: false,
        message: bodyResult.message,
      },
      bodyResult.status,
    );
  }

  const validation =
    validateLocationInput(
      bodyResult.body,
    );

  if (!validation.success) {
    return jsonResponse(
      {
        ok: false,
        message: validation.message,
        fieldErrors:
          validation.fieldErrors,
      },
      400,
    );
  }

  try {
    const location =
      await updateLocation(
        gate.access.activeClientId,
        locationId,
        gate.access.profileId,
        validation.data,
      );

    revalidatePath(
      "/dashboard/locations",
    );

    revalidatePath(
      `/dashboard/locations/${locationId}`,
    );

    revalidatePath(
      "/dashboard/brands",
    );

    revalidatePath(
      `/dashboard/brands/${validation.data.businessBrandId}`,
    );

    revalidatePath("/dashboard");

    return jsonResponse(
      {
        ok: true,
        message:
          "The location was updated successfully.",
        location,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "locations-update",
      error,
      "The location could not be updated.",
    );
  }
}