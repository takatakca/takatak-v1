import { revalidatePath } from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/clients/client-service";
import { validateClientCreate } from "@/lib/clients/client-validation";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const access =
    await requirePlatformAdminApiAccess();

  if (!access.ok) {
    return access.response;
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

  const validation = validateClientCreate(
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
    const client = await createClient(
      validation.data,
      access.profileId,
    );

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/select-client");

    return jsonResponse(
      {
        ok: true,
        message:
          "The workspace was created successfully.",
        client,
      },
      201,
    );
  } catch (error) {
    return handleApiError(
      "admin-clients-create",
      error,
      "The workspace could not be created.",
    );
  }
}