import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function AdminHeader({
  title,
  subtitle,
  badges = [],
  actions,
}: {
  title: string;
  subtitle: string;
  badges?: string[];
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {badges.map((b) => (
            <Badge key={b} tone="warning">{b}</Badge>
          ))}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
