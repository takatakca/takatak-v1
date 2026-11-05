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
  saveReviewDraft,
  type ReviewDraftDecisionState,
  type ReviewDraftEditState,
} from "@/lib/reputation/review-approval-service";
export async function decideReviewDraftAction(
  _previous: ReviewDraftDecisionState,
  form: FormData,
): Promise<ReviewDraftDecisionState> {
  try {
    const { access } = await getServerAccessContext();
    if (
      access.mode !== "client_scoped" ||
      !hasEffectivePermission(access, "manage_reputation") ||
      !hasEffectivePermission(access, "approve_content")
    )
      return {
        ok: false,
        error:
          "Votre rôle ne permet pas d’approuver les réponses de cet espace.",
      };
    const decision = form.get("decision");
    if (decision !== "approve" && decision !== "reject")
      return { ok: false, error: "Choisissez approuver ou rejeter." };
    if (
      decision === "approve" &&
      !(await clientHasGrowthFeature(access.activeClientId, "ai_autopilot"))
    )
      return { ok: false, error: FEATURE_UPSELL.ai_autopilot };
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
        "La décision n’a pas pu être confirmée. Actualisez avant de réessayer.",
    };
  }
}

export async function saveReviewDraftAction(
  _previous: ReviewDraftEditState,
  form: FormData,
): Promise<ReviewDraftEditState> {
  try {
    const { access } = await getServerAccessContext();
    if (
      access.mode !== "client_scoped" ||
      !hasEffectivePermission(access, "manage_reputation") ||
      !hasEffectivePermission(access, "approve_content")
    )
      return {
        ok: false,
        error:
          "Votre rôle ne permet pas de modifier les réponses de cet espace.",
      };
    if (!(await clientHasGrowthFeature(access.activeClientId, "ai_autopilot")))
      return { ok: false, error: FEATURE_UPSELL.ai_autopilot };
    const text = form.get("replyText");
    if (typeof text !== "string")
      return { ok: false, error: "Saisissez le texte de la réponse." };
    const result = await saveReviewDraft(
      access.activeClientId,
      access.profileId,
      String(form.get("runId") || ""),
      String(form.get("expectedDraftHash") || ""),
      text,
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
        "La modification n’a pas pu être confirmée. Conservez votre texte et actualisez avant de réessayer.",
    };
  }
}
