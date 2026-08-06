import type { ReactNode } from "react";
import { StatusBadge } from "./status-badge";

export function ModuleHeader({
  title,
  description,
  statuses = [],
  actions,
}: {
  title: string;
  description: string;
  statuses?: string[];
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {statuses.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
