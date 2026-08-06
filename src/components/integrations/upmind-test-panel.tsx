"use client";

import { useState } from "react";
import { Loader2, PlugZap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UPMIND_STATE_LABELS, upmindToneForState } from "@/lib/integrations/upmind/status";
import type { UpmindConnectionState } from "@/lib/integrations/upmind/types";

interface TestResponse {
  state: UpmindConnectionState;
  message: string;
  httpStatus?: number;
  dbUpdated?: boolean;
}

export function UpmindTestPanel() {
  const [result, setResult] = useState<TestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function runTest() {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/integrations/upmind/test", { method: "POST" });
      setResult((await res.json()) as TestResponse);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={runTest}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
        {loading ? "Testing…" : "Run test connection"}
      </button>
      <p className="text-[11px] text-slate-400">
        A successful test requires real Upmind credentials and a confirmed documented endpoint.
      </p>
      {failed ? <p className="text-xs text-rose-600">Test request could not be sent. Try again.</p> : null}
      {result ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <Badge tone={upmindToneForState(result.state)}>{UPMIND_STATE_LABELS[result.state]}</Badge>
            {typeof result.httpStatus === "number" ? <span className="text-[11px] text-slate-400">HTTP {result.httpStatus}</span> : null}
            {result.dbUpdated ? <span className="text-[11px] text-slate-400">· DB status updated</span> : null}
          </div>
          <p className="mt-1 text-xs text-slate-600">{result.message}</p>
        </div>
      ) : null}
    </div>
  );
}
