"use server";

import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { allowWebsiteCheck, TOO_MANY_CHECKS } from "@/lib/web-hosting/check-limit";
import { runSecurityCheck, type SecurityCheckResult } from "@/lib/web-hosting/security-check";

export type SecurityCheckState = SecurityCheckResult | { ok: null };

/** Checks one public website from the outside. Signed-in dashboard users only; nothing is stored. */
export async function securityCheckAction(_prev: SecurityCheckState, formData: FormData): Promise<SecurityCheckState> {
  const { access, profileDetails } = await getServerAccessContext();
  if (!hasEffectivePermission(access, "view_dashboard") || !profileDetails?.id) {
    return { ok: false, error: "Connectez-vous pour lancer la vérification · Sign in to run the check." };
  }
  if (!allowWebsiteCheck(profileDetails.id)) return { ok: false, error: TOO_MANY_CHECKS };
  return runSecurityCheck(String(formData.get("url") ?? ""));
}
