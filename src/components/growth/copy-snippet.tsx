"use client";

import { useState } from "react";

export function CopySnippet({ code, label = "Copy code" }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-600">Paste before &lt;/body&gt; on the website</p>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300"
        >
          {copied ? "Copied" : label}
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-4 text-slate-700">{code}</pre>
    </div>
  );
}
