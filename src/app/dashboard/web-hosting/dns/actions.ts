"use server";

import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { runDnsCheck, type DnsCheckResult } from "@/lib/web-hosting/dns-check";

export type DnsCheckState = DnsCheckResult | { ok: null };

/** Reads one domain's public DNS. Signed-in dashboard users only; nothing is stored or changed. */
export async function dnsCheckAction(_prev: DnsCheckState, formData: FormData): Promise<DnsCheckState> {
  const { access } = await getServerAccessContext();
  if (!hasEffectivePermission(access, "view_dashboard")) {
    return { ok: false, error: "Connectez-vous pour lancer la vérification · Sign in to run the check." };
  }
  return runDnsCheck(String(formData.get("domain") ?? ""));
}
