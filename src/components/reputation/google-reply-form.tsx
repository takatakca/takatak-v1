"use client";

import { useActionState } from "react";

import { replyGoogleReviewAction, type GoogleReplyState } from "@/app/dashboard/growth/reviews/actions";

const initialState: GoogleReplyState = { ok: null };

export function GoogleReplyForm({ reviewId, draft }: { reviewId: string; draft: string | null }) {
  const [state, formAction, pending] = useActionState(replyGoogleReviewAction, initialState);
  if (state.ok === true) return <p className="text-xs text-emerald-700">Reply published on Google. ✓</p>;
  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="reviewId" value={reviewId} />
      <textarea
        name="comment"
        rows={2}
        maxLength={4000}
        defaultValue={draft ?? ""}
        placeholder="Write a public reply…"
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
      />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Publishing…" : "Publish reply on Google"}
        </button>
        {state.ok === false ? (
          <span role="alert" className="text-xs text-rose-700">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
