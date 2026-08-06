import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

/** Honest foundation form: shows the future input structure, fully disabled.
 *  Generation activates only after a real provider connection is verified. */
export function PlannedGeneratorForm({
  title,
  subtitle,
  fields,
  buttonLabel,
  footnote,
}: {
  title: string;
  subtitle: string;
  fields: { label: string; placeholder: string; kind?: "input" | "textarea" | "select"; options?: string[] }[];
  buttonLabel: string;
  footnote?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody className="space-y-3">
        {fields.map((f) => (
          <div key={f.label}>
            <label className="mb-1 block text-xs font-medium text-slate-500">{f.label}</label>
            {f.kind === "textarea" ? (
              <textarea disabled rows={3} placeholder={f.placeholder} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400" />
            ) : f.kind === "select" ? (
              <select disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                <option>{f.placeholder}</option>
                {(f.options ?? []).map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input disabled placeholder={f.placeholder} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400" />
            )}
          </div>
        ))}
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-400 ring-1 ring-inset ring-slate-200"
        >
          <Sparkles className="h-4 w-4" />
          {buttonLabel}
          <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Needs verified provider
          </span>
        </button>
        {footnote ? <div className="text-[11px] leading-relaxed text-slate-400">{footnote}</div> : null}
      </CardBody>
    </Card>
  );
}
