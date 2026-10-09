"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import { replyAction, type ReplyState } from "@/app/dashboard/growth/conversations/actions";

const initialState: ReplyState = { ok: null };

/** Staff reply box; also refreshes the thread every few seconds while open. */
export function ReplyForm({ conversationId, disabled }: { conversationId: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(replyAction, initialState);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok === true) formRef.current?.reset();
  }, [state]);

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <textarea
        name="body"
        rows={3}
        maxLength={2000}
        disabled={disabled}
        placeholder={disabled ? "Conversation closed — reopen to reply." : "Write a reply…"}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) formRef.current?.requestSubmit();
        }}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || disabled} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Sending…" : "Send reply"}
        </button>
        <span className="text-[11px] text-slate-400">Ctrl/⌘ + Enter to send</span>
        {state.ok === false ? (
          <p role="alert" className="text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
