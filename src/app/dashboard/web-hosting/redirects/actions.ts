"use server";

import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { runRedirectCheck, type RedirectCheckResult } from "@/lib/web-hosting/redirect-check";

export type RedirectCheckState = RedirectCheckResult | { ok: null };

/** Follows one public link hop by hop. Signed-in dashboard users only; nothing is stored. */
export async function redirectCheckAction(_prev: RedirectCheckState, formData: FormData): Promise<RedirectCheckState> {
  const { access } = await getServerAccessContext();
  if (!hasEffectivePermission(access, "view_dashboard")) {
    return { ok: false, error: "Connectez-vous pour lancer la vérification · Sign in to run the check." };
  }
  return runRedirectCheck(String(formData.get("url") ?? ""));
}
