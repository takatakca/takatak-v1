import type { NextResponse } from "next/server";

import { jsonResponse } from "@/lib/security/api-response";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { Permission } from "@/lib/security/roles";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";

export type WorkspaceApiPermissionResult =
  | {
      ok: true;
      access: ClientScopedAccess;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireWorkspaceApiPermission(
  permission: Permission,
): Promise<WorkspaceApiPermissionResult> {
  const { access } =
    await getServerAccessContext();

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
            "Workspace access is temporarily unavailable.",
        },
        503,
      ),
    };
  }

  if (access.mode === "foundation_demo") {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          message:
            "Database-backed workspace access is required for this operation.",
        },
        503,
      ),
    };
  }

  if (
    access.mode === "selection_required" ||
    access.mode === "platform_admin"
  ) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          message:
            "Select a client workspace before continuing.",
        },
        403,
      ),
    };
  }

  if (access.mode !== "client_scoped") {
    const message =
      access.mode === "denied" &&
      access.reason === "client_inactive"
        ? "The selected workspace is paused or archived."
        : access.mode === "denied" &&
            access.reason ===
              "membership_suspended"
          ? "Your workspace membership is suspended."
          : "You do not have access to this workspace.";

    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          message,
        },
        403,
      ),
    };
  }

  if (
    !hasEffectivePermission(
      access,
      permission,
    )
  ) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          message:
            "You do not have permission to perform this action.",
        },
        403,
      ),
    };
  }

  return {
    ok: true,
    access,
  };
}