"use server";

import { revalidatePath } from "next/cache";

import { getPrisma } from "@/lib/db/prisma";
import { QMAPS_BUSINESS_ID, qmapsReplyMetadata, replyOutcome } from "@/lib/qmaps/bridge";
import { postQmaps } from "@/lib/qmaps/remote";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

const PATH = "/dashboard/local-listings/reviews";

export type QmapsReplyFormState =
  | { ok: null }
  | { ok: true; sent: boolean; message: string }
  | { ok: false; error: string };

export async function replyQmapsReviewAction(
  _prev: QmapsReplyFormState,
  formData: FormData,
): Promise<QmapsReplyFormState> {
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped" || !hasEffectivePermission(access, "manage_reputation")) {
    return { ok: false, error: "Vous n'avez pas la permission de répondre aux avis de cet espace." };
  }
  const prisma = getPrisma();
  if (!prisma) return { ok: false, error: "La base TAKATAK n'est pas configurée. La réponse n'a pas été envoyée." };

  const reviewId = String(formData.get("qmapsReviewId") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim().replace(/\s+/g, " ");
  const listingReviewId = String(formData.get("listingReviewId") ?? "").trim();
  if (!QMAPS_BUSINESS_ID.test(reviewId)) return { ok: false, error: "L'identifiant de l'avis QMAPS doit être un UUID." };
  if (comment.length < 1 || comment.length > 2000) return { ok: false, error: "Écrivez une réponse de 2000 caractères au plus." };
  if (listingReviewId && !QMAPS_BUSINESS_ID.test(listingReviewId)) {
    return { ok: false, error: "Avis TAKATAK introuvable dans cet espace. Rien n'a été envoyé." };
  }

  if (listingReviewId) {
    const existing = await prisma.listingReview.findFirst({
      where: { id: listingReviewId, clientId: access.activeClientId },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Avis TAKATAK introuvable dans cet espace. Rien n'a été envoyé." };
  }

  const remote = await postQmaps("takatak-reply-review", { reviewId, body: comment });
  const outcome = replyOutcome(remote);
  const metadata = qmapsReplyMetadata(reviewId, comment, outcome.replyState);
  const data = {
    provider: "qmaps" as const,
    replyStatus: outcome.replyStatus,
    metadata,
  };

  if (listingReviewId) {
    const updated = await prisma.listingReview.updateMany({
      where: { id: listingReviewId, clientId: access.activeClientId },
      data,
    });
    if (updated.count !== 1) {
      return {
        ok: false,
        error: remote.ok
          ? "QMAPS a reçu la réponse, mais TAKATAK n'a pas pu l'associer à cet avis."
          : "QMAPS n'a pas publié la réponse, et TAKATAK n'a pas trouvé cet avis.",
      };
    }
  } else {
    await prisma.listingReview.create({
      data: {
        ...data,
        clientId: access.activeClientId,
        status: "needs_review",
        title: "Réponse QMAPS",
      },
    });
  }

  revalidatePath(PATH);
  return { ok: true, sent: remote.ok, message: outcome.message };
}
