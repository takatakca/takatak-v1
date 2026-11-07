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
import {
  generateReviewRunDraft,
  type ReviewDraftGenerationState,
} from "@/lib/reputation/review-generation";
import {
  publishApprovedReviewDraft,
  type ReviewDraftPublicationState,
} from "@/lib/reputation/review-native-publication";

export async function publishReviewDraftAction(
  _previous: ReviewDraftPublicationState,
  form: FormData,
): Promise<ReviewDraftPublicationState> {
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
          "Votre rôle ne permet pas de publier les réponses approuvées de cet espace.",
      };
    for (const feature of ["reputation", "ai_autopilot"] as const) {
      if (!(await clientHasGrowthFeature(access.activeClientId, feature)))
        return { ok: false, error: FEATURE_UPSELL[feature] };
    }
    const result = await publishApprovedReviewDraft(
      access.activeClientId,
      access.profileId,
      String(form.get("runId") || ""),
      String(form.get("expectedDraftHash") || ""),
    );
    if (!result.ok)
      return {
        ok: false,
        error:
          "La publication n’a pas été confirmée. Actualisez le traitement et vérifiez la source avant de réessayer.",
      };
    revalidatePath("/dashboard/growth/reviews");
    revalidatePath("/dashboard/growth/ai-engine");
    return {
      ok: true,
      message: "La source a confirmé la publication de la réponse approuvée.",
    };
  } catch {
    return {
      ok: false,
      error:
        "La publication n’a pas pu être confirmée. Vérifiez la source et actualisez avant toute nouvelle tentative.",
    };
  }
}

export async function generateReviewDraftAction(
  _previous: ReviewDraftGenerationState,
  form: FormData,
): Promise<ReviewDraftGenerationState> {
  try {
    const { access } = await getServerAccessContext();
    if (
      access.mode !== "client_scoped" ||
      !hasEffectivePermission(access, "manage_reputation")
    )
      return {
        ok: false,
        error:
          "Votre rôle ne permet pas de générer les réponses de cet espace.",
      };
    for (const feature of ["reputation", "ai_autopilot"] as const) {
      if (!(await clientHasGrowthFeature(access.activeClientId, feature)))
        return { ok: false, error: FEATURE_UPSELL[feature] };
    }
    const result = await generateReviewRunDraft(
      access.activeClientId,
      access.profileId,
      String(form.get("runId") || ""),
    );
    if (!result.ok) {
      const messages: Record<string, string> = {
        not_configured:
          "La génération IA n’est pas configurée. Votre demande reste en file sans débit.",
        insufficient_credits:
          "Le solde de cet espace est insuffisant pour générer une réponse.",
        daily_limit:
          "La limite quotidienne de génération de cet espace est atteinte.",
        review_changed:
          "L’avis a changé depuis la demande. Actualisez et demandez un nouveau brouillon.",
        agent_disabled:
          "Activez Review Responder dans votre équipe IA avant de générer.",
        provider_failed:
          "Le moteur IA n’a pas retourné de réponse valide. Actualisez pour vérifier le traitement et le crédit.",
      };
      return {
        ok: false,
        error:
          messages[result.code] ??
          "La génération n’a pas pu être confirmée. Actualisez le traitement avant de réessayer.",
      };
    }
    revalidatePath("/dashboard/growth/reviews");
    revalidatePath("/dashboard/growth/ai-engine");
    return {
      ok: true,
      message:
        "Brouillon enregistré. Relisez-le et approuvez sa version enregistrée avant toute publication.",
    };
  } catch {
    return {
      ok: false,
      error:
        "La génération n’a pas pu être confirmée. Actualisez le traitement et votre solde avant de réessayer.",
    };
  }
}

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
