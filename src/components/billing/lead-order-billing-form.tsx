"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// GROUPE TAKATAK Billing — queue the invoice for a won takatak.ca order.
// Taxes are explicit: nothing is pre-checked and no jurisdiction is assumed.
const TAX_PRESETS = [
  { code: "TPS", label: "TPS 5 %", rateMilliPercent: 5000 },
  { code: "TVQ", label: "TVQ 9,975 %", rateMilliPercent: 9975 },
  { code: "TVH", label: "TVH 13 %", rateMilliPercent: 13000 },
] as const;

function cad(cents: number): string {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

export function LeadOrderBillingForm({ leadId, totalCents }: { leadId: string; totalCents: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [dueInDays, setDueInDays] = useState(30);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taxes = TAX_PRESETS.filter((tax) => selected.includes(tax.code));
  // Each tax on the subtotal, rounded half-up (Facturations recalculates).
  const taxCents = taxes.reduce((sum, tax) => sum + Math.floor((totalCents * tax.rateMilliPercent + 50_000) / 100_000), 0);

  function toggle(code: string) {
    setSelected((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));
  }

  async function submit() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/billing/lead-orders/${encodeURIComponent(leadId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueInDays, taxes: taxes.map(({ code, label, rateMilliPercent }) => ({ code, label, rateMilliPercent })) }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

      if (response.ok && body?.ok) {
        router.refresh();
        return;
      }

      setError(body?.message ?? "The invoice request could not be created.");
    } catch {
      setError("The invoice request could not be created.");
    }

    setPending(false);
  }

  return (
    <div className="space-y-3 text-sm">
      <fieldset>
        <legend className="text-xs font-medium text-slate-500">Taxes (choose explicitly)</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {TAX_PRESETS.map((tax) => (
            <label key={tax.code} className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={selected.includes(tax.code)} onChange={() => toggle(tax.code)} />
              {tax.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Due in (days)</span>
        <input
          type="number"
          min={0}
          max={90}
          value={dueInDays}
          onChange={(event) => setDueInDays(Math.max(0, Math.min(90, Number.parseInt(event.target.value, 10) || 0)))}
          className="mt-1 block w-24 rounded-md border border-slate-300 px-2 py-1"
        />
      </label>
      <p className="text-xs text-slate-500">
        Estimate: {cad(totalCents)} + taxes {cad(taxCents)} = <strong>{cad(totalCents + taxCents)}</strong>. Facturations recalculates the final amounts.
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create invoice request"}
      </button>
      {error ? <p role="alert" className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
