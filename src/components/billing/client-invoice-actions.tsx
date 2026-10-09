"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ClientInvoiceAction } from "@/lib/billing/client-invoicing/invoice-actions";

const CONFIRM: Partial<Record<ClientInvoiceAction, string>> = {
  void: "Annuler cette facture ? Votre client ne pourra plus la payer. Cette action est définitive.",
  mark_paid: "Marquer cette facture comme payée hors ligne (chèque, virement, comptant) ? Stripe ne prélèvera rien et la facture sera close.",
};

const DONE: Record<ClientInvoiceAction, string> = {
  remind: "Rappel envoyé.",
  void: "Facture annulée.",
  mark_paid: "Facture marquée payée.",
};

// Client invoicing — actions on one open invoice of the workspace's own
// Stripe account. The server re-reads the invoice from that account before
// acting, and a reminder is sent at most once per day.
export function ClientInvoiceActions({ invoiceId, remindable }: { invoiceId: string; remindable: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<ClientInvoiceAction | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function run(action: ClientInvoiceAction) {
    const question = CONFIRM[action];

    if (question && !window.confirm(question)) {
      return;
    }

    setPending(action);
    setMessage(null);

    try {
      const response = await fetch(`/api/billing/client-invoicing/invoices/${encodeURIComponent(invoiceId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

      if (response.ok && body?.ok) {
        setMessage({ tone: "ok", text: DONE[action] });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: body?.message ?? "L’action n’a pas pu être effectuée." });
      }
    } catch {
      setMessage({ tone: "error", text: "L’action n’a pas pu être effectuée." });
    }

    setPending(null);
  }

  const button = "font-medium disabled:cursor-wait disabled:opacity-60";

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="flex gap-3">
        {remindable ? (
          <button type="button" disabled={pending !== null} onClick={() => run("remind")} className={`${button} text-indigo-600 hover:text-indigo-500`}>
            {pending === "remind" ? "Envoi…" : "Relancer"}
          </button>
        ) : null}
        <button type="button" disabled={pending !== null} onClick={() => run("mark_paid")} className={`${button} text-emerald-700 hover:text-emerald-600`}>
          {pending === "mark_paid" ? "…" : "Payée hors ligne"}
        </button>
        <button type="button" disabled={pending !== null} onClick={() => run("void")} className={`${button} text-rose-600 hover:text-rose-500`}>
          {pending === "void" ? "…" : "Annuler"}
        </button>
      </span>
      {message ? (
        <span role={message.tone === "error" ? "alert" : "status"} className={`max-w-[16rem] whitespace-normal text-right text-xs ${message.tone === "error" ? "text-rose-600" : "text-emerald-700"}`}>
          {message.text}
        </span>
      ) : null}
    </span>
  );
}
