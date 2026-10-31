"use client";

import { useActionState } from "react";

import {
  replyQmapsReviewAction,
  type QmapsReplyFormState,
} from "@/app/dashboard/local-listings/reviews/actions";

const initialState: QmapsReplyFormState = { ok: null };
const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function QmapsReplyForm({
  reviewId,
  listingReviewId,
}: { reviewId?: string; listingReviewId?: string } = {}) {
  const [state, formAction, pending] = useActionState(
    replyQmapsReviewAction,
    initialState,
  );
  return (
    <form action={formAction} className="grid gap-3">
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Identifiant de l&apos;avis QMAPS
        <input
          name="qmapsReviewId"
          defaultValue={reviewId}
          readOnly={!!reviewId}
          required
          placeholder="UUID de l'avis"
          className={inputClass}
        />
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Avis TAKATAK suivi dans cet espace
        <input
          name="listingReviewId"
          defaultValue={listingReviewId}
          readOnly={!!listingReviewId}
          required
          placeholder="UUID TAKATAK"
          className={inputClass}
        />
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Réponse
        <textarea
          name="comment"
          required
          maxLength={2000}
          rows={4}
          className={inputClass}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Envoi…" : "Répondre sur QMAPS"}
        </button>
        {state.ok === true ? (
          <p
            className={
              state.sent ? "text-xs text-emerald-700" : "text-xs text-amber-700"
            }
          >
            {state.message}
          </p>
        ) : null}
        {state.ok === false ? (
          <p role="alert" className="text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
