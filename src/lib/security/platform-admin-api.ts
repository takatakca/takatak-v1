import { NextResponse } from "next/server";

import { jsonResponse } from "@/lib/security/api-response";
import { getPlatformAdminAccess } from "@/lib/security/platform-admin-access";

export type PlatformAdminApiAccess =
  | {
      ok: true;
      profileId: string;
      role: "owner" | "admin";
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requirePlatformAdminApiAccess(): Promise<PlatformAdminApiAccess> {
  const access = await getPlatformAdminAccess();

  if (
    access.mode === "denied" &&
    access.reason === "not_authenticated"
  ) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          message: "Authentication is required.",
        },
        401,
      ),
    };
  }

  if (
    access.mode === "denied" &&
    (access.reason === "database_unavailable" ||
      access.reason ===
        "production_foundation_blocked")
  ) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          message:
            "Platform administration is unavailable.",
        },
        503,
      ),
    };
  }

  if (access.mode !== "authorized") {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          message:
            "Platform Admin access is required.",
        },
        403,
      ),
    };
  }

  return {
    ok: true,
    profileId: access.profileId,
    role: access.role,
  };
}