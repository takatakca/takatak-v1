"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
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
  origin: "feedback" | "external";
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
          ? "Queueing…"
          : state.ok === true
            ? "Draft queued"
            : "Request AI draft"}
      </button>
      {state.ok === true && (
        <p role="status" className="text-xs text-slate-600">
          Request queued in the existing AI workforce. No reply has been
          generated or published yet.{" "}
          <Link className="underline" href="/dashboard/growth/ai-engine">
            View runs and approvals
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
