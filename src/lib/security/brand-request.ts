// Request-boundary brand cookie I/O. Domain code must pass requestedBrandId
// explicitly and must not import this module from scripts or workers.
import { cookies } from "next/headers";

import {
  ACTIVE_BRAND_COOKIE,
  resolveBrandSessionContext,
  type BrandSessionContext,
} from "@/lib/security/brand-context";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";
import { applyWorkspaceCookieClear } from "@/lib/security/workspace-cookie-mutation";

export async function resolveBrandSessionContextFromRequest(
  access: ClientScopedAccess,
): Promise<BrandSessionContext> {
  const jar = await cookies();
  const requestedBrandId = jar.get(ACTIVE_BRAND_COOKIE)?.value ?? null;
  const result = await resolveBrandSessionContext(access, requestedBrandId);
  applyWorkspaceCookieClear(result.staleBrandCookie, ACTIVE_BRAND_COOKIE, {
    delete: (name) => {
      jar.delete(name);
    },
  });
  return result;
}
