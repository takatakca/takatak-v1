"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AI_CREDIT_ACTIONS } from "@/lib/growth/ai-engine";
import { reviewApprovalHash } from "@/lib/reputation/workspace-navigation";
import { navigateReviewWorkspace } from "./review-workspace-navigation";
import {
  requestReviewDraftAction,
  type ReviewDraftState,
} from "@/app/dashboard/growth/reviews/actions";
const initial: ReviewDraftState = { ok: null };
export function ReviewDraftForm({
  reviewId,
  origin,
}: {
  reviewId: string;
  origin: "feedback" | "external" | "listing";
}) {
  const [state, action, pending] = useActionState(
    requestReviewDraftAction,
    initial,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="origin" value={origin} />
      <button
        disabled={pending || state.ok === true}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1565D8] disabled:opacity-50"
      >
        <Sparkles className="h-3 w-3" />
        {pending
          ? "Mise en file…"
          : state.ok === true
            ? "Brouillon demandé"
            : "Demander une réponse IA"}
      </button>
      <span className="block text-[11px] text-slate-600">
        Tarif catalogue de génération :{" "}
        {AI_CREDIT_ACTIONS.find((action) => action.key === "review_reply")
          ?.credits ?? "—"}{" "}
        crédit. La mise en file et l’approbation ne prélèvent aucun crédit.
      </span>
      {state.ok === true && (
        <p role="status" className="text-xs text-slate-600">
          Demande enregistrée. La génération et la publication restent à
          confirmer.{" "}
          <Link
            className="underline"
            href={reviewApprovalHash(state.runId)}
            onNavigate={(event) => {
              event.preventDefault();
              navigateReviewWorkspace(reviewApprovalHash(state.runId));
            }}
          >
            Ouvrir cette réponse dans le studio
          </Link>
        </p>
      )}
      {state.ok === false && (
        <p role="alert" className="text-xs text-rose-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
