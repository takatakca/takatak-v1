// Phase 15A — Single per-request server access resolver.
// React cache() dedupes within one request render; nothing user-specific is
// cached across users/requests. No tokens or cookies are returned.
// (server-only marker removed: these modules are server-side by usage —
// next/headers + Prisma — and must stay importable by tsx QA scripts.)
import { cache } from "react";
import { cookies } from "next/headers";
import { getRuntimeInfo, type RuntimeInfo } from "@/lib/security/runtime-mode";
import {
  parseBoundClientCookie,
  staleActiveClientCookie,
  AUTH_IDENTITY_COOKIE,
} from "@/lib/security/authenticated-identity";
import { getSessionUser } from "@/lib/auth/supabase-server";
import {
  resolveTenantAccessBundle,
  type ShellProfileDetails,
  type TenantAccess,
} from "@/lib/security/tenant-access";

export const ACTIVE_CLIENT_COOKIE = "takatak_active_client";

export interface ServerAccessContext {
  runtime: RuntimeInfo;
  access: TenantAccess;
  displayEmail: string | null; // safe identity only — never tokens
  profileDetails: ShellProfileDetails | null;
  activeClientName: string | null;
}

export const getServerAccessContext = cache(async (): Promise<ServerAccessContext> => {
  const runtime = getRuntimeInfo();
  const user = await getSessionUser();
  let requestedClientId: string | null = null;
  try {
    const jar = await cookies();
    const rawClient = jar.get(ACTIVE_CLIENT_COOKIE)?.value ?? null;
    requestedClientId = parseBoundClientCookie(
      rawClient,
      user?.id ?? null,
      jar.get(AUTH_IDENTITY_COOKIE)?.value ?? null,
    );
    if (rawClient && !requestedClientId) {
      jar.delete(ACTIVE_CLIENT_COOKIE);
    }
  } catch {
    requestedClientId = null;
  }
  const { access, profileDetails, clientNames } =
    await resolveTenantAccessBundle(requestedClientId);
  if (staleActiveClientCookie({ requestedClientId, access })) {
    try {
      const jar = await cookies();
      jar.delete(ACTIVE_CLIENT_COOKIE);
    } catch {
      // Cookie mutation is not always available in Server Components.
    }
  }
  const displayEmail: string | null = profileDetails?.email ?? null;
  return {
    runtime,
    access,
    displayEmail,
    profileDetails,
    activeClientName:
      access.mode === "client_scoped"
        ? clientNames[access.activeClientId] ?? null
        : null,
  };
});
