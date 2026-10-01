import { NextRequest } from "next/server";

import {
  authErrorResponse,
  authJson,
  wrapAuthRoute,
} from "@/lib/auth/auth-json";
import { ensureProfileForAuthenticatedUser } from "@/lib/auth/profile-sync";
import { isTrustedRequestOrigin } from "@/lib/auth/trusted-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleSyncProfile(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return authErrorResponse("The request origin could not be verified.", 403, {
      code: "invalid_request",
    });
  }

  const result = await ensureProfileForAuthenticatedUser();

  if (result.outcome === "denied") {
    return authErrorResponse("The TAKATAK identity could not be authorized.", 403, {
      code: "identity_mismatch",
    });
  }

  if (result.outcome === "unavailable" || result.outcome === "error") {
    return authErrorResponse("The TAKATAK profile could not be synchronized.", 503, {
      code: "profile_sync_failed",
    });
  }

  return authJson(
    {
      ok: true,
      message: "TAKATAK profile synchronized.",
      profileId: result.profileId,
      outcome: result.outcome,
    },
    200,
  );
}

export const POST = wrapAuthRoute(
  "sync-profile",
  "The TAKATAK profile service is temporarily unavailable.",
  handleSyncProfile,
);
