// Request-independent workspace cookie interpretation.
// Callers supply the raw cookie value (or an already-parsed client id).
// Cookie deletion belongs at a Next.js request boundary via CookieMutator.

import {
  parseBoundClientCookie,
  staleActiveClientCookie,
} from "@/lib/security/authenticated-identity";
import type { TenantAccess } from "@/lib/security/tenant-access";

export type WorkspaceSelectionReport = {
  requestedClientId: string | null;
  invalidWorkspaceCookie: boolean;
  staleWorkspaceSelection: boolean;
  shouldClearWorkspaceCookie: boolean;
  activeClientId: string | null;
  allowedClientIds: string[] | "all";
};

export function reportWorkspaceSelection(input: {
  access: TenantAccess;
  requestedClientId?: string | null;
  rawClientCookie?: string | null;
  authUserId?: string | null;
  identityCookie?: string | null;
}): WorkspaceSelectionReport {
  const raw = input.rawClientCookie ?? null;
  const requestedClientId =
    input.requestedClientId !== undefined
      ? input.requestedClientId
      : parseBoundClientCookie(
          raw,
          input.authUserId ?? null,
          input.identityCookie ?? null,
        );
  const invalidWorkspaceCookie = Boolean(raw) && !requestedClientId;
  const staleWorkspaceSelection = staleActiveClientCookie({
    requestedClientId,
    access: input.access,
  });

  const allowedClientIds =
    input.access.mode === "client_scoped" ||
    input.access.mode === "selection_required"
      ? input.access.allowedClientIds
      : input.access.mode === "platform_admin"
        ? "all"
        : [];

  return {
    requestedClientId,
    invalidWorkspaceCookie,
    staleWorkspaceSelection,
    shouldClearWorkspaceCookie:
      invalidWorkspaceCookie || staleWorkspaceSelection,
    activeClientId:
      input.access.mode === "client_scoped"
        ? input.access.activeClientId
        : null,
    allowedClientIds,
  };
}
