import { revalidatePath } from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { updateBrand } from "@/lib/brands/brand-service";
import { validateBrandInput } from "@/lib/brands/brand-validation";
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
      brandId: string;
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

  const { brandId } =
    await context.params;

  if (!isUuid(brandId)) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The selected brand identifier is invalid.",
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
    validateBrandInput(bodyResult.body);

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
    const brand = await updateBrand(
      gate.access.activeClientId,
      brandId,
      gate.access.profileId,
      validation.data,
    );

    revalidatePath(
      "/dashboard/brands",
    );

    revalidatePath(
      `/dashboard/brands/${brandId}`,
    );

    revalidatePath(
      "/dashboard/locations",
    );

    revalidatePath("/dashboard");

    return jsonResponse(
      {
        ok: true,
        message:
          "The brand was updated successfully.",
        brand,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "brands-update",
      error,
      "The brand could not be updated.",
    );
  }
}