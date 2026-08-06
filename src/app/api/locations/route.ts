import { revalidatePath } from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createLocation } from "@/lib/locations/location-service";
import { validateLocationInput } from "@/lib/locations/location-validation";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const gate =
    await requireWorkspaceApiPermission(
      "manage_brands",
    );

  if (!gate.ok) {
    return gate.response;
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
      await createLocation(
        gate.access.activeClientId,
        gate.access.profileId,
        validation.data,
      );

    revalidatePath(
      "/dashboard/locations",
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
          "The location was created successfully.",
        location,
      },
      201,
    );
  } catch (error) {
    return handleApiError(
      "locations-create",
      error,
      "The location could not be created.",
    );
  }
}