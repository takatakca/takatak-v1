"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_CLIENT_COOKIE } from "@/lib/security/access-context";
import { ACTIVE_BRAND_COOKIE } from "@/lib/security/brand-context";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";
import { resolveTenantAccess } from "@/lib/security/tenant-access";

export async function setActiveClient(
  formData: FormData,
) {
  const clientId = String(
    formData.get("clientId") ?? "",
  ).trim();

  const nextPath = sanitizeNextPath(
    String(
      formData.get("next") ??
        "/dashboard",
    ),
  );

  if (!clientId) {
    redirect(
      `/dashboard/select-client?next=${encodeURIComponent(
        nextPath,
      )}`,
    );
  }

  const access =
    await resolveTenantAccess(clientId);

  if (access.mode !== "client_scoped") {
    redirect(
      `/dashboard/select-client?next=${encodeURIComponent(
        nextPath,
      )}`,
    );
  }

  const cookieStore = await cookies();

  cookieStore.delete(
    ACTIVE_BRAND_COOKIE,
  );

  cookieStore.set(
    ACTIVE_CLIENT_COOKIE,
    clientId,
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

export async function enterPlatformAdministration() {
  const cookieStore = await cookies();

  cookieStore.delete(
    ACTIVE_CLIENT_COOKIE,
  );

  cookieStore.delete(
    ACTIVE_BRAND_COOKIE,
  );

  redirect("/dashboard/admin");
}