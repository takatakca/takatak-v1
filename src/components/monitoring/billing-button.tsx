"use client";
import { useState } from "react";
import Link from "next/link";

export function MonitoringBillingButton({ domainAssetId, subscribed, enabled }: { domainAssetId: string; subscribed: boolean; enabled: boolean }) {
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function start() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/billing/monitoring", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainAssetId, action: subscribed ? "portal" : "checkout", acceptedTerms: accepted }) });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.url) throw new Error(result.message ?? "Billing is temporarily unavailable.");
      const url = new URL(result.url);
      if (url.protocol !== "https:" || !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)) throw new Error("Invalid billing destination.");
      window.location.assign(url.href);
    } catch (error) { setError(error instanceof Error ? error.message : "Billing is temporarily unavailable."); setBusy(false); }
  }
  return <div className="space-y-3">
    {!subscribed && <label className="flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1" /><span>I agree to $5 CAD / website / month plus applicable taxes, recurring until canceled, and the <Link href="/terms-of-service" className="underline">service terms</Link>. Monitoring begins after activation.</span></label>}
    <button type="button" onClick={start} disabled={busy || (!subscribed && (!enabled || !accepted))} className="rounded-xl bg-[#1565D8] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Opening billing…" : subscribed ? "Manage subscription & invoices" : "Subscribe through TAKATAK"}</button>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </div>;
}
