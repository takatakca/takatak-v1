"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Link2, Loader2, Send, XCircle } from "lucide-react";

import { useDashboardLanguage } from "@/components/layout/dashboard-language";

type ActionResponse = {
  ok: boolean;
  message?: string;
  code?: string;
};

type Action = "submit" | "cancel" | "reconcile";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function InvoiceRequestActions({
  requestId,
  canSubmit,
  canCancel,
  canReconcile,
  isOwner,
}: {
  requestId: string;
  canSubmit: boolean;
  canCancel: boolean;
  canReconcile: boolean;
  isOwner: boolean;
}) {
  const fr = useDashboardLanguage() === "fr";
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draftId, setDraftId] = useState("");

  async function run(action: Action) {
    if (pending) {
      return;
    }

    if (
      action === "cancel" &&
      !window.confirm(fr ? "Annuler cette demande de facture ? C’est irréversible." : "Cancel this invoice request? This cannot be undone.")
    ) {
      return;
    }

    if (action === "reconcile" && !UUID_PATTERN.test(draftId.trim())) {
      setMessage(fr ? "Collez l’identifiant du brouillon (UUID) affiché dans Facturations." : "Paste the draft id (UUID) shown in Facturations.");
      return;
    }

    setPending(action);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/billing/invoice-requests/${requestId}/${action}`,
        action === "reconcile"
          ? {
              method: "POST",
              headers: { Accept: "application/json", "Content-Type": "application/json" },
              body: JSON.stringify({ facturationsDraftId: draftId.trim() }),
            }
          : { method: "POST", headers: { Accept: "application/json" } },
      );
      const body = (await response.json().catch(() => ({}))) as ActionResponse;

      if (!response.ok || !body.ok) {
        setMessage(
          body.message
            ? `${body.message}${body.code ? ` (${body.code})` : ""}`
            : fr
              ? "L’action a échoué."
              : "The action failed.",
        );
      }
    } catch {
      setMessage(fr ? "Erreur réseau. Vous pouvez réessayer sans risque." : "Network error. It is safe to retry.");
    } finally {
      setPending(null);
      router.refresh();
    }
  }

  const showSubmit = canSubmit && isOwner;
  const showReconcile = canReconcile && isOwner;

  if (!showSubmit && !canCancel && !showReconcile) {
    return null;
  }

  const spinner = <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {showSubmit ? (
          <button
            type="button"
            onClick={() => run("submit")}
            disabled={pending !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending === "submit" ? spinner : <Send className="h-3.5 w-3.5" aria-hidden />}
            {fr ? "Créer le brouillon" : "Create draft"}
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            onClick={() => run("cancel")}
            disabled={pending !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            {pending === "cancel" ? spinner : <XCircle className="h-3.5 w-3.5" aria-hidden />}
            {fr ? "Annuler" : "Cancel"}
          </button>
        ) : null}
      </div>
      {showReconcile ? (
        <div className="flex items-center gap-1.5">
          <input
            aria-label={fr ? "Identifiant du brouillon Facturations" : "Facturations draft id"}
            placeholder={fr ? "Identifiant du brouillon Facturations" : "Facturations draft id"}
            value={draftId}
            onChange={(event) => setDraftId(event.target.value)}
            className="w-56 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => run("reconcile")}
            disabled={pending !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending === "reconcile" ? spinner : <Link2 className="h-3.5 w-3.5" aria-hidden />}
            {fr ? "Lier le brouillon" : "Link draft"}
          </button>
        </div>
      ) : null}
      {message ? (
        <p role="alert" className="max-w-xs text-right text-xs text-rose-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
