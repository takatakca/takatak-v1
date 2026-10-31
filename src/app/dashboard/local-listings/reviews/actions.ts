"use server";

import { revalidatePath } from "next/cache";

import {
  clientHasGrowthFeature,
  FEATURE_UPSELL,
} from "@/lib/billing/growth/entitlements";
import { getPrisma } from "@/lib/db/prisma";
import {
  QMAPS_BUSINESS_ID,
  matchesTrackedQmapsReview,
  qmapsReplyMetadata,
  replyOutcome,
} from "@/lib/qmaps/bridge";
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
  if (
    access.mode !== "client_scoped" ||
    !hasEffectivePermission(access, "manage_reputation")
  ) {
    return {
      ok: false,
      error:
        "Vous n'avez pas la permission de répondre aux avis de cet espace.",
    };
  }
  if (!(await clientHasGrowthFeature(access.activeClientId, "reputation")))
    return { ok: false, error: FEATURE_UPSELL.reputation };
  const prisma = getPrisma();
  if (!prisma)
    return {
      ok: false,
      error:
        "La base TAKATAK n'est pas configurée. La réponse n'a pas été envoyée.",
    };

  const reviewId = String(formData.get("qmapsReviewId") ?? "").trim();
  const comment = String(formData.get("comment") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const listingReviewId = String(formData.get("listingReviewId") ?? "").trim();
  if (!QMAPS_BUSINESS_ID.test(reviewId))
    return {
      ok: false,
      error: "L'identifiant de l'avis QMAPS doit être un UUID.",
    };
  if (comment.length < 1 || comment.length > 2000)
    return {
      ok: false,
      error: "Écrivez une réponse de 2000 caractères au plus.",
    };
  if (!QMAPS_BUSINESS_ID.test(listingReviewId))
    return {
      ok: false,
      error:
        "Choisissez un avis QMAPS déjà suivi dans cet espace. Rien n'a été envoyé.",
    };
  const existing = await prisma.listingReview.findFirst({
    where: {
      id: listingReviewId,
      clientId: access.activeClientId,
      provider: "qmaps",
      status: { not: "archived" },
      localListing: { clientId: access.activeClientId, provider: "qmaps" },
    },
    select: { id: true, metadata: true },
  });
  if (!existing || !matchesTrackedQmapsReview(existing.metadata, reviewId))
    return {
      ok: false,
      error: "Cet avis QMAPS n'est pas lié à cet espace. Rien n'a été envoyé.",
    };

  const remote = await postQmaps("takatak-reply-review", {
    reviewId,
    body: comment,
  });
  const outcome = replyOutcome(remote);
  const savedMetadata =
    existing.metadata &&
    typeof existing.metadata === "object" &&
    !Array.isArray(existing.metadata)
      ? existing.metadata
      : {};
  const metadata = {
    ...savedMetadata,
    ...qmapsReplyMetadata(reviewId, comment, outcome.replyState),
  };
  const data = {
    provider: "qmaps" as const,
    replyStatus: outcome.replyStatus,
    metadata,
  };

  const updated = await prisma.listingReview.updateMany({
    where: {
      id: listingReviewId,
      clientId: access.activeClientId,
      provider: "qmaps",
      metadata: { path: ["qmapsReviewId"], equals: reviewId },
    },
    data,
  });
  if (updated.count !== 1)
    return {
      ok: false,
      error: remote.ok
        ? "QMAPS a reçu la réponse, mais l'association locale doit être vérifiée."
        : "Cet avis n'est plus lié à cet espace. Réponse non publiée.",
    };

  revalidatePath(PATH);
  revalidatePath("/dashboard/growth/reviews");
  return { ok: true, sent: remote.ok, message: outcome.message };
}
