"use server";

import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { loadGoogleAccessToken } from "@/lib/social/providers/google-business-performance";
import { googleLiveLocationUrl, parseLiveGoogleBusinessNap } from "@/lib/local-listings/google-live-nap";
import type { CitationRow } from "@/lib/local-listings/citation-audit";

type LiveReadResult =
  | { ok: true; observedAt: string; row: CitationRow }
  | { ok: false; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cooldown = new Map<string, number>();
const COOLDOWN_MS = 120_000;

/**
 * Explicit, read-only Google API check. User may only request their CURRENT
 * workspace's selected, authorized Social Google Business location.
 * Server-side operator flag OFF by default. No billing or provider writes.
 */
export async function readLiveGoogleBusinessNap(
  socialAccountId: string,
): Promise<LiveReadResult> {
  if (process.env.TAKATAK_LOCAL_CITATION_GBP_LIVE_READ !== "true") {
    return { ok: false, reason: "Google live verification is not enabled." };
  }
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped" ||
      !hasEffectivePermission(access, "manage_integrations")) {
    return { ok: false, reason: "Workspace permission required." };
  }
  if (typeof socialAccountId !== "string" || !UUID.test(socialAccountId)) {
    return { ok: false, reason: "Choose a connected Google location." };
  }
  const prisma = getPrisma();
  if (!prisma) return { ok: false, reason: "Database unavailable." };

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: socialAccountId,
      clientId: access.activeClientId,
      platform: "google_business",
      status: "connected",
      accessStatus: "selected",
      isAvailableThroughAuth: true,
      providerConnection: { provider: "google_business", status: "connected" },
    },
    select: { externalAccountId: true, providerConnectionId: true },
  });
  if (!account?.providerConnectionId || !account.externalAccountId) {
    return { ok: false, reason: "Google Business Profile not connected for this location." };
  }
  const url = googleLiveLocationUrl(account.externalAccountId);
  if (!url) return { ok: false, reason: "Google location identity is invalid." };

  const rateKey = access.activeClientId + ":" + socialAccountId;
  const now = Date.now();
  if ((cooldown.get(rateKey) ?? 0) + COOLDOWN_MS > now) {
    return { ok: false, reason: "Please allow two minutes between live checks." };
  }
  // Local process cooldown; do not claim distributed quota enforcement.
  if (cooldown.size > 1000) cooldown.clear();
  cooldown.set(rateKey, now);

  try {
    const token = await loadGoogleAccessToken({
      clientId: access.activeClientId,
      connectionId: account.providerConnectionId,
    });
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: "Bearer " + token },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "Google API authorization or project access is not approved." };
    }
    if (response.status === 429) {
      return { ok: false, reason: "Google API quota reached. Retry later." };
    }
    if (!response.ok) return { ok: false, reason: "Google could not retrieve this location." };
    const data: unknown = await response.json().catch(() => null);
    const row = parseLiveGoogleBusinessNap(data, account.externalAccountId);
    if (!row) return { ok: false, reason: "Google returned an unexpected location response." };
    return { ok: true, observedAt: new Date().toISOString(), row };
  } catch {
    // No access tokens, private payloads or refresh-token errors in logs.
    return { ok: false, reason: "Live Google verification is temporarily unavailable." };
  }
}
