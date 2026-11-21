"use server";

import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { allowWebsiteCheck, TOO_MANY_CHECKS } from "@/lib/web-hosting/check-limit";
import { runDnsCheck, type DnsCheckResult } from "@/lib/web-hosting/dns-check";

export type DnsCheckState = DnsCheckResult | { ok: null };

/** Reads one domain's public DNS. Signed-in dashboard users only; nothing is stored or changed. */
export async function dnsCheckAction(_prev: DnsCheckState, formData: FormData): Promise<DnsCheckState> {
  const { access, profileDetails } = await getServerAccessContext();
  if (!hasEffectivePermission(access, "view_dashboard") || !profileDetails?.id) {
    return { ok: false, error: "Connectez-vous pour lancer la vérification · Sign in to run the check." };
  }
  if (!allowWebsiteCheck(profileDetails.id)) return { ok: false, error: TOO_MANY_CHECKS };
  return runDnsCheck(String(formData.get("domain") ?? ""));
}
