"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";

export function RunAuditButton({ host }: { host: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setMessage(null);
    try {
      const response = await fetch("/api/seo/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; status?: string };
      if (!response.ok || !body.ok) {
        setMessage(body.message ?? "The audit could not be started.");
      } else if (body.status === "failed") {
        setMessage("The website could not be reached. Check that it is online and try again.");
      }
      router.refresh();
    } catch {
      setMessage("The audit could not be started. Check your connection.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
        {running ? "Auditing… up to a minute" : "Run audit"}
      </button>
      {message ? <p role="alert" className="max-w-xs text-right text-xs text-rose-700">{message}</p> : null}
    </div>
  );
}
