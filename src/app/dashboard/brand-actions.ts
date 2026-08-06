"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { ACTIVE_BRAND_COOKIE } from "@/lib/security/brand-context";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";
import { isUuid } from "@/lib/validation/common";

export async function setActiveBrand(
  formData: FormData,
) {
  const brandId = String(
    formData.get("brandId") ?? "",
  ).trim();

  const nextPath = sanitizeNextPath(
    String(
      formData.get("next") ??
        "/dashboard/brands",
    ),
  );

  const { access } =
    await getServerAccessContext();

  if (access.mode !== "client_scoped") {
    redirect("/dashboard/select-client");
  }

  const cookieStore = await cookies();

  if (!brandId) {
    cookieStore.delete(
      ACTIVE_BRAND_COOKIE,
    );

    redirect(nextPath);
  }

  if (!isUuid(brandId)) {
    cookieStore.delete(
      ACTIVE_BRAND_COOKIE,
    );

    redirect(nextPath);
  }

  const prisma = getPrisma();

  if (!prisma) {
    redirect(nextPath);
  }

  const brand =
    await prisma.businessBrand.findFirst({
      where: {
        id: brandId,
        clientId: access.activeClientId,
        status: {
          not: "archived",
        },
      },
      select: {
        id: true,
      },
    });

  if (!brand) {
    cookieStore.delete(
      ACTIVE_BRAND_COOKIE,
    );

    redirect(nextPath);
  }

  cookieStore.set(
    ACTIVE_BRAND_COOKIE,
    brand.id,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  );

  redirect(nextPath);
}