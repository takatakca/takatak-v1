"use client";

import { useState } from "react";

// GROUPE TAKATAK Billing — "Payer" for a Facturations invoice. Asks the
// server for a Stripe Checkout page and only follows Stripe-hosted HTTPS.
export function FacturationsPayButton({ requestId }: { requestId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/billing/client-invoices/${encodeURIComponent(requestId)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; message?: string } | null;
      const url = body?.ok && typeof body.url === "string" ? new URL(body.url) : null;

      if (url && url.protocol === "https:" && url.hostname === "checkout.stripe.com") {
        window.location.assign(url.toString());
        return;
      }

      setError(body?.message ?? "Le paiement n’a pas pu être ouvert.");
    } catch {
      setError("Le paiement n’a pas pu être ouvert.");
    }

    setPending(false);
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={pay}
        disabled={pending}
        className="font-medium text-indigo-600 hover:text-indigo-500 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Ouverture…" : "Payer"}
      </button>
      {error ? (
        <span role="alert" className="mt-1 max-w-[14rem] whitespace-normal text-right text-xs text-rose-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
