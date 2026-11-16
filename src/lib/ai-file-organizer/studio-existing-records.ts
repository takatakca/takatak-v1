import "server-only";
import { isBillingExemptWorkspace } from "@/lib/billing/billing-exemption-policy";
import { getPrisma } from "@/lib/db/prisma";
import { STUDIO_OUTPUT_SOURCE } from "@/lib/studio/production";
import { ORGANIZER_GROWTH_PLAN_KEY, organizerSubscriptionActive } from "./entitlement-policy";
import type { OrganizerStudioSource } from "./studio-approval";

/** Global rollout switch is OFF until billing, consent and storage are ready. */
export async function hasOrganizerEntitlement(clientId: string): Promise<boolean> {
  if (process.env.TAKATAK_AI_FILE_ORGANIZER_ENABLED !== "true") return false;
  if (isBillingExemptWorkspace(clientId)) return true;
  const db = getPrisma();
  if (!db) return false;
  const row = await db.growthSubscription.findUnique({
    where: { clientId_planKey: { clientId, planKey: ORGANIZER_GROWTH_PLAN_KEY } },
    select: { status: true, stripeSubscriptionId: true, currentPeriodEnd: true },
  });
  return organizerSubscriptionActive(row);
}

/** Only tenant-owned Studio text drafts can be previewed for organization. */
export async function loadOrganizerStudioOutput(clientId: string, outputId: string): Promise<OrganizerStudioSource | null> {
  const db = getPrisma();
  if (!db) return null;
  const row = await db.savedAiOutput.findFirst({
    where: {
      id: outputId,
      clientId,
      origin: "ai_generated",
      status: { in: ["saved", "draft", "sent_to_approval"] },
      metadata: { path: ["source"], equals: STUDIO_OUTPUT_SOURCE },
    },
    select: { clientId: true, origin: true, status: true },
  });
  if (!row) return null;
  return { clientId: row.clientId, origin: row.origin, status: row.status, source: STUDIO_OUTPUT_SOURCE };
}
