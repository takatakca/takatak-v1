"use client";

import { useState } from "react";

// Client invoicing — opens Stripe-hosted onboarding for the workspace's own
// Stripe account. Only follows https://connect.stripe.com URLs.
export function ClientConnectButton({ label }: { label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/client-invoicing/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; message?: string } | null;
      const url = body?.ok && typeof body.url === "string" ? new URL(body.url) : null;

      if (url && url.protocol === "https:" && url.hostname === "connect.stripe.com") {
        window.location.assign(url.toString());
        return;
      }

      setError(body?.message ?? "La configuration Stripe n’a pas pu être ouverte.");
    } catch {
      setError("La configuration Stripe n’a pas pu être ouverte.");
    }

    setPending(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={connect}
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Ouverture de Stripe…" : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
