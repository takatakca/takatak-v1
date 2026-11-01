"use server";
import { revalidatePath } from "next/cache";
import {
  clientHasGrowthFeature,
  FEATURE_UPSELL,
} from "@/lib/billing/growth/entitlements";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import {
  decideReviewDraft,
  type ReviewDraftDecisionState,
} from "@/lib/reputation/review-approval-service";
export async function decideReviewDraftAction(
  _previous: ReviewDraftDecisionState,
  form: FormData,
): Promise<ReviewDraftDecisionState> {
  const { access } = await getServerAccessContext();
  if (
    access.mode !== "client_scoped" ||
    !hasEffectivePermission(access, "manage_reputation") ||
    !hasEffectivePermission(access, "approve_content")
  )
    return {
      ok: false,
      error: "Votre rôle ne permet pas d’approuver les réponses de cet espace.",
    };
  const decision = form.get("decision");
  if (decision !== "approve" && decision !== "reject")
    return { ok: false, error: "Choisissez approuver ou rejeter." };
  if (
    decision === "approve" &&
    !(await clientHasGrowthFeature(access.activeClientId, "ai_autopilot"))
  )
    return { ok: false, error: FEATURE_UPSELL.ai_autopilot };
  try {
    const result = await decideReviewDraft(
      access.activeClientId,
      access.profileId,
      String(form.get("runId") || ""),
      decision,
      String(form.get("expectedDraftHash") || ""),
    );
    if (result.ok) {
      revalidatePath("/dashboard/growth/reviews");
      revalidatePath("/dashboard/growth/ai-engine");
    }
    return result;
  } catch {
    return {
      ok: false,
      error:
        "La décision n’a pas pu être enregistrée. Actualisez avant de réessayer.",
    };
  }
}
