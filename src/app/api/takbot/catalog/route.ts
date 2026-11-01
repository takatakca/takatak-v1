import type { NextResponse } from "next/server";

import { json } from "@/lib/ai-credits/http";
import { getServerAccessContext } from "@/lib/security/access-context";
import { TAKBOT_ENGINES, TAKBOT_MODES, TAKBOT_PACKS, creditsFor } from "@/lib/takbot/catalog";
import { connectedEngines, creditBalance, takbotCheckoutEnabled, trialStatus } from "@/lib/takbot/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET — what TAK bot can do right now: engines with a live connection flag,
 * modes with their credit cost, credit packs, the trial offer (and whether
 * this workspace used it), and the visitor's own balance when signed in to a
 * workspace. Never returns keys or another client's data.
 */
export async function GET(): Promise<NextResponse> {
  const connected = await connectedEngines();
  let session: { signedIn: boolean; workspace: boolean; balance: number | null; firstName: string | null } = {
    signedIn: false,
    workspace: false,
    balance: null,
    firstName: null,
  };
  let workspaceId: string | null = null;
  try {
    const { access, profileDetails } = await getServerAccessContext();
    const firstName = profileDetails?.firstName?.trim().slice(0, 40) || null;
    if (access.mode === "client_scoped") {
      workspaceId = access.activeClientId;
      session = { signedIn: true, workspace: true, balance: await creditBalance(access.activeClientId), firstName };
    } else if ("profileId" in access) {
      session = { signedIn: true, workspace: false, balance: null, firstName };
    }
  } catch {
    // Auth not configured: the catalog stays public and read-only.
  }
  const trial = await trialStatus(workspaceId);
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
    trial,
    session,
  });
}
