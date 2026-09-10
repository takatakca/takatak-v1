// Phase 15A — Single per-request server access resolver.
// React cache() dedupes within one request render; nothing user-specific is
// cached across users/requests. No tokens or cookies are returned.
// This module is a Next.js request boundary: it may call cookies().
import { cache } from "react";
import { cookies } from "next/headers";
import { getRuntimeInfo, type RuntimeInfo } from "@/lib/security/runtime-mode";
import {
  parseBoundClientCookie,
  AUTH_IDENTITY_COOKIE,
} from "@/lib/security/authenticated-identity";
import { getSessionUser } from "@/lib/auth/supabase-server";
import {
  resolveTenantAccessBundle,
  type ShellProfileDetails,
  type TenantAccess,
} from "@/lib/security/tenant-access";
import { applyWorkspaceCookieClear } from "@/lib/security/workspace-cookie-mutation";
import { reportWorkspaceSelection } from "@/lib/security/workspace-selection";

export const ACTIVE_CLIENT_COOKIE = "takatak_active_client";

export interface ServerAccessContext {
  runtime: RuntimeInfo;
  access: TenantAccess;
  displayEmail: string | null; // safe identity only — never tokens
  profileDetails: ShellProfileDetails | null;
  activeClientName: string | null;
  workspaceSelection: ReturnType<typeof reportWorkspaceSelection>;
}

export const getServerAccessContext = cache(async (): Promise<ServerAccessContext> => {
  const runtime = getRuntimeInfo();
  const user = await getSessionUser();
  const jar = await cookies();
  const rawClient = jar.get(ACTIVE_CLIENT_COOKIE)?.value ?? null;
  const requestedClientId = parseBoundClientCookie(
    rawClient,
    user?.id ?? null,
    jar.get(AUTH_IDENTITY_COOKIE)?.value ?? null,
  );
  const { access, profileDetails, clientNames } =
    await resolveTenantAccessBundle(requestedClientId);
  const workspaceSelection = reportWorkspaceSelection({
    access,
    requestedClientId,
    rawClientCookie: rawClient,
    authUserId: user?.id ?? null,
    identityCookie: jar.get(AUTH_IDENTITY_COOKIE)?.value ?? null,
  });
  applyWorkspaceCookieClear(
    workspaceSelection.shouldClearWorkspaceCookie,
    ACTIVE_CLIENT_COOKIE,
    {
      delete: (name) => {
        jar.delete(name);
      },
    },
  );
  const displayEmail: string | null = profileDetails?.email ?? null;
  return {
    runtime,
    access,
    displayEmail,
    profileDetails,
    workspaceSelection,
    activeClientName:
      access.mode === "client_scoped"
        ? clientNames[access.activeClientId] ?? null
        : null,
  };
});
