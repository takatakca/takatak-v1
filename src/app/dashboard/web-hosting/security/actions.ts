"use server";

import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { runSecurityCheck, type SecurityCheckResult } from "@/lib/web-hosting/security-check";

export type SecurityCheckState = SecurityCheckResult | { ok: null };

/** Checks one public website from the outside. Signed-in dashboard users only; nothing is stored. */
export async function securityCheckAction(_prev: SecurityCheckState, formData: FormData): Promise<SecurityCheckState> {
  const { access } = await getServerAccessContext();
  if (!hasEffectivePermission(access, "view_dashboard")) {
    return { ok: false, error: "Connectez-vous pour lancer la vérification · Sign in to run the check." };
  }
  return runSecurityCheck(String(formData.get("url") ?? ""));
}
