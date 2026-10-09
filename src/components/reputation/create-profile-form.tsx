"use client";

import { useActionState } from "react";

import { createReviewProfileAction, type ProfileFormState } from "@/app/dashboard/growth/reviews/actions";

const initialState: ProfileFormState = { ok: null };
const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function CreateProfileForm({ brands }: { brands: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(createReviewProfileAction, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Business name *
          <input name="name" required maxLength={80} placeholder="Garage Verdun" className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Brand (optional)
          <select name="businessBrandId" className={inputClass} defaultValue="">
            <option value="">— None —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Google Place ID
          <input name="googlePlaceId" maxLength={200} placeholder="ChIJ…" className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Facebook review link
          <input name="facebookReviewUrl" maxLength={300} placeholder="https://www.facebook.com/…/reviews" className={inputClass} />
        </label>
      </div>
      <label className="block space-y-1 text-xs font-medium text-slate-700">
        Thank-you note shown to customers (optional)
        <input name="thankYouMessage" maxLength={280} placeholder="Merci de nous faire confiance !" className={inputClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Creating…" : "Create review page"}
        </button>
        {state.ok === true ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
        {state.ok === false ? (
          <p role="alert" className="text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
