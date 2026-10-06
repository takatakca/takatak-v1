"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { validateInvoiceDraftInput } from "@/lib/billing/invoices/draft-input";
import { dollarsToCents, percentToMilliPercent } from "@/lib/billing/invoices/money-input";
import { estimateInvoice, formatCad } from "@/lib/billing/invoices/preview";

type LineState = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxable: boolean;
};

type TaxState = { code: string; label: string; ratePercent: string };

type SaveResponse = {
  ok: boolean;
  created?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

const EMPTY_LINE: LineState = { description: "", quantity: "1", unitPrice: "", taxable: true };

// Convenience presets only: the owner adds them explicitly and reviews them.
const TAX_PRESETS: TaxState[] = [
  { code: "GST", label: "TPS / GST", ratePercent: "5.000" },
  { code: "QST", label: "TVQ / QST", ratePercent: "9.975" },
];

function today(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);

  return date.toISOString().slice(0, 10);
}

function newReference(): string {
  return `manual:${crypto.randomUUID()}`;
}

const INPUT =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function ManualInvoiceRequestForm() {
  const router = useRouter();
  const [sourceReference, setSourceReference] = useState(newReference);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => today());
  const [dueDate, setDueDate] = useState(() => today(15));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineState[]>([{ ...EMPTY_LINE }]);
  const [taxes, setTaxes] = useState<TaxState[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const draft = useMemo(
    () => ({
      currency: "CAD",
      customer: {
        name: customerName,
        email: customerEmail,
        address: customerAddress.trim() ? customerAddress : null,
      },
      invoiceDate,
      dueDate,
      notes: notes.trim() ? notes : null,
      lines: lines.map((line) => ({
        description: line.description,
        quantity: /^\d{1,4}$/.test(line.quantity.trim()) ? Number(line.quantity.trim()) : -1,
        unitPriceCents: dollarsToCents(line.unitPrice) ?? -1,
        discountCents: 0,
        taxable: line.taxable,
      })),
      taxes: taxes.map((tax) => ({
        code: tax.code.trim().toUpperCase(),
        label: tax.label,
        rateMilliPercent: percentToMilliPercent(tax.ratePercent) ?? -1,
      })),
    }),
    [customerName, customerEmail, customerAddress, invoiceDate, dueDate, notes, lines, taxes],
  );

  const validation = useMemo(() => validateInvoiceDraftInput(draft), [draft]);
  const estimate = useMemo(() => {
    if (!validation.success) {
      return null;
    }

    try {
      return estimateInvoice(validation.data);
    } catch {
      return null;
    }
  }, [validation]);

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((current) =>
      current.map((line, position) => (position === index ? { ...line, ...patch } : line)),
    );
  }

  function updateTax(index: number, patch: Partial<TaxState>) {
    setTaxes((current) =>
      current.map((tax, position) => (position === index ? { ...tax, ...patch } : tax)),
    );
  }

  async function save() {
    if (saving) {
      return;
    }

    if (!validation.success) {
      setFieldErrors(validation.fieldErrors);
      setResult({ tone: "error", text: validation.message });
      return;
    }

    setSaving(true);
    setResult(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/admin/billing/invoice-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sourceApp: "manual",
          sourceReference,
          clientId: null,
          draft: validation.data,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as SaveResponse;

      if (!response.ok || !body.ok) {
        setFieldErrors(body.fieldErrors ?? {});
        setResult({ tone: "error", text: body.message ?? "The request could not be saved." });
        return;
      }

      setResult({
        tone: "ok",
        text: body.created
          ? "Invoice request queued. Review it below, then create the Facturations draft."
          : "This request was already queued.",
      });
      setSourceReference(newReference());
      setCustomerName("");
      setCustomerEmail("");
      setCustomerAddress("");
      setNotes("");
      setLines([{ ...EMPTY_LINE }]);
      setTaxes([]);
      router.refresh();
    } catch {
      // Same sourceReference on retry: the server returns the existing request.
      setResult({ tone: "error", text: "Network error. It is safe to retry." });
    } finally {
      setSaving(false);
    }
  }

  const errorEntries = Object.entries(fieldErrors);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Customer name
          <input className={INPUT} value={customerName} maxLength={160} onChange={(e) => setCustomerName(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Customer email
          <input className={INPUT} type="email" value={customerEmail} maxLength={254} onChange={(e) => setCustomerEmail(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600 sm:col-span-2">
          Address (optional)
          <input className={INPUT} value={customerAddress} maxLength={500} onChange={(e) => setCustomerAddress(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Invoice date
          <input className={INPUT} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Due date
          <input className={INPUT} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-slate-700">Lines (CAD)</legend>
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-12 items-end gap-2">
            <label className="col-span-12 space-y-1 text-xs text-slate-600 sm:col-span-6">
              Description
              <input className={INPUT} value={line.description} maxLength={250} onChange={(e) => updateLine(index, { description: e.target.value })} />
            </label>
            <label className="col-span-3 space-y-1 text-xs text-slate-600 sm:col-span-1">
              Qty
              <input className={INPUT} inputMode="numeric" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
            </label>
            <label className="col-span-5 space-y-1 text-xs text-slate-600 sm:col-span-2">
              Unit price $
              <input className={INPUT} inputMode="decimal" placeholder="0.00" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} />
            </label>
            <label className="col-span-3 flex items-center gap-1.5 pb-2 text-xs text-slate-600 sm:col-span-2">
              <input type="checkbox" checked={line.taxable} onChange={(e) => updateLine(index, { taxable: e.target.checked })} />
              Taxable
            </label>
            <button
              type="button"
              aria-label={`Remove line ${index + 1}`}
              className="col-span-1 pb-2 text-slate-400 hover:text-rose-600 disabled:opacity-30"
              disabled={lines.length === 1}
              onClick={() => setLines((current) => current.filter((_, position) => position !== index))}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-40"
          disabled={lines.length >= 50}
          onClick={() => setLines((current) => [...current, { ...EMPTY_LINE }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add line
        </button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-slate-700">
          Taxes — explicit rates only, reviewed by the owner
        </legend>
        {taxes.map((tax, index) => (
          <div key={index} className="grid grid-cols-12 items-end gap-2">
            <label className="col-span-3 space-y-1 text-xs text-slate-600">
              Code
              <input className={INPUT} value={tax.code} maxLength={20} onChange={(e) => updateTax(index, { code: e.target.value })} />
            </label>
            <label className="col-span-5 space-y-1 text-xs text-slate-600">
              Label
              <input className={INPUT} value={tax.label} maxLength={80} onChange={(e) => updateTax(index, { label: e.target.value })} />
            </label>
            <label className="col-span-3 space-y-1 text-xs text-slate-600">
              Rate %
              <input className={INPUT} inputMode="decimal" value={tax.ratePercent} onChange={(e) => updateTax(index, { ratePercent: e.target.value })} />
            </label>
            <button
              type="button"
              aria-label={`Remove tax ${index + 1}`}
              className="col-span-1 pb-2 text-slate-400 hover:text-rose-600"
              onClick={() => setTaxes((current) => current.filter((_, position) => position !== index))}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          {TAX_PRESETS.map((preset) => (
            <button
              key={preset.code}
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-40"
              disabled={taxes.length >= 3 || taxes.some((tax) => tax.code === preset.code)}
              onClick={() => setTaxes((current) => [...current, { ...preset }])}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> {preset.label} {preset.ratePercent}%
            </button>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-40"
            disabled={taxes.length >= 3}
            onClick={() => setTaxes((current) => [...current, { code: "", label: "", ratePercent: "" }])}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Custom tax
          </button>
        </div>
      </fieldset>

      <label className="block space-y-1 text-xs font-medium text-slate-600">
        Notes (optional)
        <textarea className={INPUT} rows={2} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
        <div className="text-xs text-slate-600">
          {estimate ? (
            <>
              Estimate: subtotal {formatCad(estimate.subtotalCents)} · taxes{" "}
              {formatCad(estimate.taxTotalCents)} ·{" "}
              <span className="font-semibold text-slate-900">total {formatCad(estimate.totalCents)}</span>
              <span className="ml-1 text-slate-400">(Facturations recalculates)</span>
            </>
          ) : (
            "Complete the form to see the estimate."
          )}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Queue invoice request
        </button>
      </div>

      {result ? (
        <p role="status" className={`text-sm ${result.tone === "ok" ? "text-emerald-700" : "text-rose-600"}`}>
          {result.text}
        </p>
      ) : null}
      {errorEntries.length ? (
        <ul className="list-inside list-disc text-xs text-rose-600">
          {errorEntries.slice(0, 8).map(([field, message]) => (
            <li key={field}>
              <span className="font-mono">{field}</span>: {message}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
