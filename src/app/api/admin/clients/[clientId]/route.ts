import { revalidatePath } from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { updateClient } from "@/lib/clients/client-service";
import { validateClientUpdate } from "@/lib/clients/client-validation";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";
import { readJsonBody } from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
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

  const validation = validateClientUpdate(
    bodyResult.body,
  );

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
    const client = await updateClient(
      clientId,
      validation.data,
      access.profileId,
    );

    revalidatePath("/dashboard/clients");
    revalidatePath(
      `/dashboard/clients/${clientId}`,
    );
    revalidatePath("/dashboard/select-client");

    return jsonResponse(
      {
        ok: true,
        message:
          "The workspace was updated successfully.",
        client,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "admin-clients-update",
      error,
      "The workspace could not be updated.",
    );
  }
}