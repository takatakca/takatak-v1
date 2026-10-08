"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck, Loader2 } from "lucide-react";

export function MarkReadButton({ ids, label }: { ids?: string[]; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function markRead() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { all: true }),
      });
      if (!response.ok) setFailed(true);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={markRead}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
        {label}
      </button>
      {failed ? <span role="alert" className="text-xs text-rose-700">Not saved. Try again.</span> : null}
    </span>
  );
}
