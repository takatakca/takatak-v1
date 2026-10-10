import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function GrowthHeader({
  eyebrow = "TAKATAK Growth Suite",
  title,
  description,
  badges = [],
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  badges?: Array<{ label: string; tone?: "neutral" | "accent" | "warning" | "muted" | "success" | "danger" }>;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">{eyebrow}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
          {badges.map((b) => (
            <Badge key={b.label} tone={b.tone ?? "neutral"}>
              {b.label}
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function GrowthKpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1.5 text-xl font-bold text-slate-950">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function HonestyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
      {children}
    </div>
  );
}
