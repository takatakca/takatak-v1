import { revalidatePath } from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createBrand } from "@/lib/brands/brand-service";
import { validateBrandInput } from "@/lib/brands/brand-validation";
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
    const brand = await createBrand(
      gate.access.activeClientId,
      gate.access.profileId,
      validation.data,
    );

    revalidatePath(
      "/dashboard/brands",
    );

    revalidatePath(
      "/dashboard/locations",
    );

    revalidatePath("/dashboard");

    return jsonResponse(
      {
        ok: true,
        message:
          "The brand was created successfully.",
        brand,
      },
      201,
    );
  } catch (error) {
    return handleApiError(
      "brands-create",
      error,
      "The brand could not be created.",
    );
  }
}