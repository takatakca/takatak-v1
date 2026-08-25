import { revalidatePath } from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import {
  ACTIVE_BRAND_COOKIE,
  invalidateBrandSelectorCache,
} from "@/lib/security/brand-context";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const gate =
    await requireWorkspaceApiPermission(
      "view_social",
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

  if (
    !bodyResult.body ||
    typeof bodyResult.body !== "object" ||
    Array.isArray(bodyResult.body)
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The request body is invalid.",
      },
      400,
    );
  }

  const brandId = (
    bodyResult.body as Record<
      string,
      unknown
    >
  ).brandId;

  if (
    brandId !== null &&
    (typeof brandId !== "string" ||
      !UUID_PATTERN.test(brandId))
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "A valid brand identifier is required.",
      },
      400,
    );
  }

  try {
    if (brandId === null) {
      const response = jsonResponse(
        {
          ok: true,
          message:
            "The active brand was cleared.",
        },
        200,
      );

      response.cookies.set(
        ACTIVE_BRAND_COOKIE,
        "",
        {
          httpOnly: true,
          sameSite: "lax",
          secure:
            process.env.NODE_ENV ===
            "production",
          path: "/",
          maxAge: 0,
        },
      );

      revalidatePath(
        "/dashboard/social",
        "layout",
      );

      invalidateBrandSelectorCache(gate.access.activeClientId);

      return response;
    }

    const prisma = getPrisma();

    if (!prisma) {
      return jsonResponse(
        {
          ok: false,
          message:
            "The brand database is temporarily unavailable.",
        },
        503,
      );
    }

    const brand =
      await prisma.businessBrand.findFirst(
        {
          where: {
            id: brandId,
            clientId:
              gate.access.activeClientId,
            status: {
              not: "archived",
            },
          },

          select: {
            id: true,
            name: true,
          },
        },
      );

    if (!brand) {
      return jsonResponse(
        {
          ok: false,
          message:
            "The selected brand is not available in this workspace.",
        },
        404,
      );
    }

    const response = jsonResponse(
      {
        ok: true,
        message: `${brand.name} is now the active brand.`,
        brand: {
          id: brand.id,
          name: brand.name,
        },
      },
      200,
    );

    response.cookies.set(
      ACTIVE_BRAND_COOKIE,
      brand.id,
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      },
    );

    revalidatePath(
      "/dashboard/social",
      "layout",
    );

    invalidateBrandSelectorCache(gate.access.activeClientId);

    return response;
  } catch (error) {
    return handleApiError(
      "social-brand-context",
      error,
      "The active brand could not be changed.",
    );
  }
}
