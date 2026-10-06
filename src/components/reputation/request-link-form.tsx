"use client";

import { useActionState, useState } from "react";

import { createReviewRequestAction, type RequestLinkState } from "@/app/dashboard/growth/reviews/actions";

const initialState: RequestLinkState = { ok: null };
const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function RequestLinkForm({ profiles }: { profiles: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(createReviewRequestAction, initialState);
  const [copied, setCopied] = useState(false);
  const profileName = (id: string) => profiles.find((p) => p.id === id)?.name ?? "our team";
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");

  const message =
    state.ok === true
      ? `Bonjour${state.recipientName ? ` ${state.recipientName}` : ""} ! Merci d’avoir choisi ${profileName(profileId)}. Auriez-vous 30 secondes pour nous donner votre avis ? ${state.url}`
      : "";

  return (
    <div className="space-y-3">
      <form action={formAction} className="grid gap-3 md:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-slate-700 md:col-span-2">
          Review page
          <select name="profileId" value={profileId} onChange={(e) => setProfileId(e.target.value)} className={inputClass}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Customer first name
          <input name="recipientName" maxLength={40} placeholder="Marie" className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Sent by
          <select name="channel" defaultValue="sms" className={inputClass}>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="link">Link / other</option>
          </select>
        </label>
        <div className="md:col-span-4">
          <button type="submit" disabled={pending || !profileId} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {pending ? "Creating…" : "Create tracked request link"}
          </button>
        </div>
      </form>

      {state.ok === false ? (
        <p role="alert" className="text-xs text-rose-700">
          {state.error}
        </p>
      ) : null}

      {state.ok === true ? (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="break-all font-mono text-xs text-emerald-900">{state.url}</p>
          <p className="text-xs text-emerald-900">{message}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  setCopied(false);
                }
              }}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900"
            >
              {copied ? "Copied" : "Copy message"}
            </button>
            <a href={`sms:?&body=${encodeURIComponent(message)}`} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900">
              SMS
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent("Votre avis compte · Your feedback")}&body=${encodeURIComponent(message)}`}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900"
            >
              Email
            </a>
          </div>
          <p className="text-[11px] text-emerald-800">Each link works once and expires in 30 days. Opens and ratings are tracked below.</p>
        </div>
      ) : null}
    </div>
  );
}
