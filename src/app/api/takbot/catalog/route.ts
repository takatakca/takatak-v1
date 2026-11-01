import type { NextResponse } from "next/server";

import { json } from "@/lib/ai-credits/http";
import { getServerAccessContext } from "@/lib/security/access-context";
import { TAKBOT_ENGINES, TAKBOT_MODES, TAKBOT_PACKS, creditsFor } from "@/lib/takbot/catalog";
import { connectedEngines, creditBalance, takbotCheckoutEnabled } from "@/lib/takbot/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET — what TAK bot can do right now: engines with a live connection flag,
 * modes with their credit cost, credit packs, and the visitor's own balance
 * when signed in to a workspace. Never returns keys or another client's data.
 */
export async function GET(): Promise<NextResponse> {
  const connected = await connectedEngines();
  let session: { signedIn: boolean; workspace: boolean; balance: number | null } = { signedIn: false, workspace: false, balance: null };
  try {
    const { access } = await getServerAccessContext();
    if (access.mode === "client_scoped") {
      session = { signedIn: true, workspace: true, balance: await creditBalance(access.activeClientId) };
    } else if ("profileId" in access) {
      session = { signedIn: true, workspace: false, balance: null };
    }
  } catch {
    // Auth not configured: the catalog stays public and read-only.
  }
  return json({
    ok: true,
    engines: TAKBOT_ENGINES.map((e) => ({
      key: e.key,
      name: e.name,
      modes: e.modes,
      bestFor: e.bestFor,
      inline: e.relay !== "studio",
      connected: connected.has(e.key),
    })),
    modes: TAKBOT_MODES.map((m) => ({ key: m.key, credits: creditsFor(m), inline: m.inline, autoOrder: m.autoOrder })),
    packs: TAKBOT_PACKS.map((p) => ({ key: p.key, label: p.label, credits: p.credits, priceCad: p.priceCad })),
    checkoutEnabled: takbotCheckoutEnabled(),
    session,
  });
}
