import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export interface HealthItem {
  label: string;
  value: string;
  ok: boolean | null; // null = neutral/informational
}

export function SystemHealthPanel({ title, subtitle, items }: { title: string; subtitle?: string; items: HealthItem[] }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
            <span className="text-xs font-medium text-slate-600">{item.label}</span>
            <Badge tone={item.ok === null ? "muted" : item.ok ? "success" : "warning"}>{item.value}</Badge>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
