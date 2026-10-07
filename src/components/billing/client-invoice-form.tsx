"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  CLIENT_INVOICE_LIMITS,
  estimateClientInvoice,
  type ClientInvoiceLine,
  type ClientInvoiceTaxRate,
} from "@/lib/billing/client-invoicing/invoice-input";

// Client invoicing — invoice form. The client chooses every tax rate itself;
// the presets only fill the fields and can be changed or removed.
const PRESETS: ClientInvoiceTaxRate[] = [
  { displayName: "TPS", percentMilli: 5000 },
  { displayName: "TVQ", percentMilli: 9975 },
  { displayName: "TVH", percentMilli: 13000 },
];

const money = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });

function centsFromInput(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(normalized)) return 0;
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function milliFromInput(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,2}(\.\d{0,3})?$/.test(normalized)) return 0;
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
}

interface LineDraft { description: string; quantity: string; price: string }
interface TaxDraft { displayName: string; percent: string }

function newReference(): string {
  return crypto.randomUUID();
}

export function ClientInvoiceForm() {
  const router = useRouter();
  const [reference, setReference] = useState(newReference);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ description: "", quantity: "1", price: "" }]);
  const [taxes, setTaxes] = useState<TaxDraft[]>([]);
  const [days, setDays] = useState("30");
  const [memo, setMemo] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const parsedLines: ClientInvoiceLine[] = lines.map((line) => ({
    description: line.description.trim(),
    quantity: Number.parseInt(line.quantity, 10) || 0,
    unitAmountCents: centsFromInput(line.price),
  }));
  const parsedTaxes: ClientInvoiceTaxRate[] = taxes.map((tax) => ({
    displayName: tax.displayName.trim(),
    percentMilli: milliFromInput(tax.percent),
  }));
  const estimate = estimateClientInvoice({ lines: parsedLines, taxRates: parsedTaxes });

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function updateTax(index: number, patch: Partial<TaxDraft>) {
    setTaxes((current) => current.map((tax, i) => (i === index ? { ...tax, ...patch } : tax)));
  }

  function addPreset(preset: ClientInvoiceTaxRate) {
    if (taxes.length >= CLIENT_INVOICE_LIMITS.maxTaxRates || taxes.some((tax) => tax.displayName === preset.displayName)) return;
    setTaxes((current) => [...current, { displayName: preset.displayName, percent: (preset.percentMilli / 1000).toString().replace(".", ",") }]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/billing/client-invoicing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          customer: { name, email },
          lines: parsedLines,
          taxRates: parsedTaxes,
          daysUntilDue: Number.parseInt(days, 10),
          memo: memo.trim() || null,
        }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; invoice?: { number?: string | null } } | null;

      if (!body?.ok) {
        setMessage({ tone: "error", text: body?.message ?? "La facture n’a pas pu être envoyée." });
        return;
      }

      setMessage({ tone: "success", text: `Facture ${body.invoice?.number ?? ""} envoyée à ${email}.` });
      setReference(newReference());
      setName("");
      setEmail("");
      setLines([{ description: "", quantity: "1", price: "" }]);
      setMemo("");
      setConfirmed(false);
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "La facture n’a pas pu être envoyée. Réessayez : elle ne sera pas créée deux fois." });
    } finally {
      setPending(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Nom du client
          <input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Courriel du client
          <input className={`${input} mt-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Lignes</legend>
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-[1fr_5rem_7rem_auto] gap-2">
            <input className={input} aria-label={`Description ligne ${index + 1}`} placeholder="Description" value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} maxLength={200} required />
            <input className={input} aria-label={`Quantité ligne ${index + 1}`} inputMode="numeric" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} required />
            <input className={input} aria-label={`Prix unitaire ligne ${index + 1}`} inputMode="decimal" placeholder="0,00" value={line.price} onChange={(e) => updateLine(index, { price: e.target.value })} required />
            <button type="button" className="text-sm text-slate-500 hover:text-rose-600 disabled:opacity-30" onClick={() => setLines((c) => c.filter((_, i) => i !== index))} disabled={lines.length === 1} aria-label={`Retirer la ligne ${index + 1}`}>✕</button>
          </div>
        ))}
        {lines.length < CLIENT_INVOICE_LIMITS.maxLines ? (
          <button type="button" className="text-sm font-medium text-indigo-600 hover:text-indigo-500" onClick={() => setLines((c) => [...c, { description: "", quantity: "1", price: "" }])}>+ Ajouter une ligne</button>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Taxes (vous choisissez les taux)</legend>
        {taxes.map((tax, index) => (
          <div key={index} className="grid grid-cols-[1fr_7rem_auto] gap-2">
            <input className={input} aria-label={`Nom taxe ${index + 1}`} value={tax.displayName} onChange={(e) => updateTax(index, { displayName: e.target.value })} maxLength={40} required />
            <input className={input} aria-label={`Taux taxe ${index + 1} en %`} inputMode="decimal" value={tax.percent} onChange={(e) => updateTax(index, { percent: e.target.value })} required />
            <button type="button" className="text-sm text-slate-500 hover:text-rose-600" onClick={() => setTaxes((c) => c.filter((_, i) => i !== index))} aria-label={`Retirer la taxe ${index + 1}`}>✕</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 text-sm">
          {PRESETS.map((preset) => (
            <button key={preset.displayName} type="button" className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:border-indigo-300" onClick={() => addPreset(preset)}>
              + {preset.displayName} {(preset.percentMilli / 1000).toString().replace(".", ",")} %
            </button>
          ))}
          {taxes.length < CLIENT_INVOICE_LIMITS.maxTaxRates ? (
            <button type="button" className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-slate-600" onClick={() => setTaxes((c) => [...c, { displayName: "", percent: "" }])}>+ Autre taxe</button>
          ) : null}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label className="text-sm font-medium text-slate-700">
          Échéance (jours)
          <input className={`${input} mt-1`} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Note sur la facture (facultatif)
          <input className={`${input} mt-1`} value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} />
        </label>
      </div>

      <dl className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <div className="flex justify-between"><dt className="text-slate-600">Sous-total</dt><dd>{money.format(estimate.subtotalCents / 100)}</dd></div>
        {estimate.taxes.map((tax, index) => (
          <div key={index} className="flex justify-between"><dt className="text-slate-600">{tax.displayName || "Taxe"}</dt><dd>{money.format(tax.amountCents / 100)}</dd></div>
        ))}
        <div className="mt-1 flex justify-between font-semibold"><dt>Total estimé</dt><dd>{money.format(estimate.totalCents / 100)}</dd></div>
        <p className="mt-1 text-xs text-slate-500">Stripe calcule le total final de la facture.</p>
      </dl>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        J’ai vérifié le client, les montants et les taxes. La facture sera envoyée par Stripe à ce courriel.
      </label>

      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-rose-600" : "text-emerald-700"}`}>
          {message.text}
        </p>
      ) : null}

      <button type="submit" disabled={pending || !confirmed} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? "Envoi…" : "Créer et envoyer la facture"}
      </button>
    </form>
  );
}
