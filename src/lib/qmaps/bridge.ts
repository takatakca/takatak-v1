// TAKATAK records a QMAPS link or reply locally first.
// A remote call is confirmed only when QMAPS returns success.

export const QMAPS_BUSINESS_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QmapsLinkState = "saved_in_takatak" | "confirmed_on_qmaps";
export type QmapsReplyState = "not_sent" | "sent_to_qmaps";
export type QmapsRemoteResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "refused" | "unreachable" };

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readQmapsBusinessId(metadata: unknown): string | null {
  const id = record(metadata)?.qmapsBusinessId;
  return typeof id === "string" && QMAPS_BUSINESS_ID.test(id) ? id : null;
}

export function readLinkState(metadata: unknown): QmapsLinkState | null {
  const state = record(metadata)?.linkState;
  return state === "saved_in_takatak" || state === "confirmed_on_qmaps" ? state : null;
}

export function readReplyState(metadata: unknown): QmapsReplyState | null {
  const state = record(metadata)?.replyState;
  return state === "not_sent" || state === "sent_to_qmaps" ? state : null;
}

export function linkStateFor(remote: QmapsRemoteResult): QmapsLinkState {
  return remote.ok ? "confirmed_on_qmaps" : "saved_in_takatak";
}

export function linkMessage(remote: QmapsRemoteResult): string {
  if (remote.ok) return "Lien enregistré dans TAKATAK et confirmé sur QMAPS.";
  if (remote.reason === "not_configured") {
    return "Lien enregistré dans TAKATAK seulement. QMAPS n'est pas configuré, donc la fiche n'a pas été mise à jour.";
  }
  return "Lien enregistré dans TAKATAK. QMAPS n'a pas confirmé, donc la fiche n'est pas liée de ce côté.";
}

export function replyOutcome(remote: QmapsRemoteResult): {
  replyStatus: "draft_reply" | "replied_internal";
  replyState: QmapsReplyState;
  message: string;
} {
  if (remote.ok) {
    return {
      replyStatus: "replied_internal",
      replyState: "sent_to_qmaps",
      message: "Réponse envoyée à QMAPS.",
    };
  }
  return {
    replyStatus: "draft_reply",
    replyState: "not_sent",
    message:
      remote.reason === "not_configured"
        ? "QMAPS n'est pas configuré. La réponse n'a pas été envoyée. Elle est conservée comme brouillon."
        : "QMAPS n'a pas accepté la réponse. Elle n'a pas été publiée. Le texte est conservé comme brouillon.",
  };
}

export function qmapsLinkMetadata(businessId: string, state: QmapsLinkState) {
  return { qmapsBusinessId: businessId, linkState: state };
}

export function qmapsReplyMetadata(reviewId: string, text: string, state: QmapsReplyState) {
  return {
    qmapsReviewId: reviewId,
    replyText: text,
    replyState: state,
    ...(state === "sent_to_qmaps" ? { repliedAt: new Date().toISOString() } : {}),
  };
}
