"use server";
import { revalidatePath } from "next/cache";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import {
  clientHasGrowthFeature,
  FEATURE_UPSELL,
} from "@/lib/billing/growth/entitlements";
import {
  syncQmapsReviews,
  type QmapsPullResult,
} from "@/lib/qmaps/review-sync";
export type QmapsPullState =
  | { ok: null }
  | { ok: false; error: string }
  | Extract<QmapsPullResult, { ok: true }>;
export async function syncQmapsReviewsAction(
  _previous: QmapsPullState,
  form: FormData,
): Promise<QmapsPullState> {
  const { access } = await getServerAccessContext();
  if (
    access.mode !== "client_scoped" ||
    !hasEffectivePermission(access, "manage_reputation")
  )
    return {
      ok: false,
      error:
        "Vous n'avez pas la permission de synchroniser les avis de cet espace.",
    };
  if (!(await clientHasGrowthFeature(access.activeClientId, "reputation")))
    return { ok: false, error: FEATURE_UPSELL.reputation };
  const mode = form.get("mode");
  if (mode !== "latest" && mode !== "older")
    return { ok: false, error: "Choisissez une opération de synchronisation." };
  try {
    const result = await syncQmapsReviews(
      access.activeClientId,
      String(form.get("listingId") || ""),
      mode,
    );
    if (!result.ok) {
      const errors: Record<string, string> = {
        not_configured: "L'accès API QMAPS n'est pas configuré sur le serveur.",
        refused:
          "QMAPS a refusé l'accès. Vérifiez le lien entreprise/espace et le déploiement de l'API.",
        unreachable: "QMAPS ne répond pas. Réessayez plus tard.",
        invalid_response:
          "La réponse QMAPS ne respecte pas le contrat attendu. Aucun avis de cette page n'a été enregistré.",
        ambiguous_mapping:
          "Cette entreprise est liée plusieurs fois. Un administrateur doit corriger le lien.",
        no_cursor: "Aucune page plus ancienne n'est disponible.",
      };
      return {
        ok: false,
        error:
          errors[result.reason] ||
          "La fiche ou la base de cet espace n'est pas disponible.",
      };
    }
    revalidatePath("/dashboard/growth/reviews");
    revalidatePath("/dashboard/local-listings/reviews");
    return result;
  } catch {
    return {
      ok: false,
      error:
        "La synchronisation n'a pas pu être enregistrée. Réessayez; les identifiants empêchent les doublons.",
    };
  }
}
