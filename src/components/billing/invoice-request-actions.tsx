"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send, XCircle } from "lucide-react";

type ActionResponse = {
  ok: boolean;
  message?: string;
  code?: string;
};

export function InvoiceRequestActions({
  requestId,
  canSubmit,
  canCancel,
  isOwner,
}: {
  requestId: string;
  canSubmit: boolean;
  canCancel: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"submit" | "cancel" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: "submit" | "cancel") {
    if (pending) {
      return;
    }

    if (
      action === "cancel" &&
      !window.confirm("Cancel this invoice request? This cannot be undone.")
    ) {
      return;
    }

    setPending(action);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/billing/invoice-requests/${requestId}/${action}`,
        { method: "POST", headers: { Accept: "application/json" } },
      );
      const body = (await response.json().catch(() => ({}))) as ActionResponse;

      if (!response.ok || !body.ok) {
        setMessage(
          body.message
            ? `${body.message}${body.code ? ` (${body.code})` : ""}`
            : "The action failed.",
        );
      }
    } catch {
      setMessage("Network error. It is safe to retry.");
    } finally {
      setPending(null);
      router.refresh();
    }
  }

  if (!canSubmit && !canCancel) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {canSubmit && isOwner ? (
          <button
            type="button"
            onClick={() => run("submit")}
            disabled={pending !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending === "submit" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
            Create draft
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            onClick={() => run("cancel")}
            disabled={pending !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            {pending === "cancel" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <XCircle className="h-3.5 w-3.5" aria-hidden />
            )}
            Cancel
          </button>
        ) : null}
      </div>
      {message ? (
        <p role="alert" className="max-w-xs text-right text-xs text-rose-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
