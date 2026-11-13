import type { ReviewRecord } from "./cockpit-model";

export const REVIEW_WORKSPACE_EVENT = "revew:navigate";
export const REVIEW_APPROVALS_HASH = "#review-approvals";
export type ReviewWorkspaceSection =
  | "inbox"
  | "approvals"
  | "requests"
  | "import"
  | "connections";
const SECTIONS: Record<string, ReviewWorkspaceSection> = {
  "#review-inbox": "inbox",
  [REVIEW_APPROVALS_HASH]: "approvals",
  "#review-requests": "requests",
  "#first-party-feedback": "requests",
  "#review-import": "import",
  "#review-connections": "connections",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function reviewSectionFromHash(
  hash: string,
): ReviewWorkspaceSection | undefined {
  return SECTIONS[hash.split("?", 1)[0]];
}

/** A malformed or unavailable explicit target must never open a different run. */
export function reviewApprovalTarget(hash: string): {
  requested: boolean;
  runId: string | null;
} {
  const [anchor, ...query] = hash.split("?");
  if (anchor !== REVIEW_APPROVALS_HASH)
    return { requested: false, runId: null };
  const params = new URLSearchParams(query.join("?"));
  const values = params.getAll("run");
  if (!values.length) return { requested: false, runId: null };
  return {
    requested: true,
    runId:
      values.length === 1 && UUID.test(values[0])
        ? values[0].toLowerCase()
        : null,
  };
}

export function reviewApprovalHash(runId?: string) {
  return runId
    ? `${REVIEW_APPROVALS_HASH}?${new URLSearchParams({ run: runId })}`
    : REVIEW_APPROVALS_HASH;
}

type TreatmentIdentity = {
  id: string;
  reviewId: string | null;
  source: "google" | "qmaps" | "takatak";
  createdAt: string;
};

/** Persisted local identity and source are the join; names/text are not identities. */
export function reviewTreatmentForRecord<T extends TreatmentIdentity>(
  review: Pick<ReviewRecord, "id" | "origin" | "source">,
  runs: readonly T[],
): T | null {
  const source =
    review.origin === "feedback" && review.source === "takatak"
      ? "takatak"
      : review.origin === "external" && review.source === "google"
        ? "google"
        : review.origin === "listing" && review.source === "qmaps"
          ? "qmaps"
          : null;
  if (!source) return null;
  return (
    runs
      .filter((run) => run.reviewId === review.id && run.source === source)
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      )[0] ?? null
  );
}

export const REVIEW_TREATMENT_LABELS: Record<string, string> = {
  queued: "En attente de génération",
  running: "Génération en cours",
  awaiting_approval: "À approuver",
  approved: "Approuvé · exécution à venir",
  executing: "Exécution en cours",
  completed: "Traitement terminé",
  rejected: "Refusé",
  canceled: "Annulé",
  failed: "Échec du traitement",
};
