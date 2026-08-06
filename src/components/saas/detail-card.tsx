import type { ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export function DetailCard({
  title,
  subtitle,
  items,
  footer,
}: {
  title: string;
  subtitle?: string;
  items: { label: string; value: ReactNode }[];
  footer?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{item.label}</dt>
              <dd className="mt-0.5 text-sm text-slate-700">{item.value}</dd>
            </div>
          ))}
        </dl>
        {footer ? <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">{footer}</div> : null}
      </CardBody>
    </Card>
  );
}
