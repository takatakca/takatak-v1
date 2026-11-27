"use client";

import { useDashboardLanguage } from "@/components/layout/dashboard-language";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { adminFr } from "@/lib/admin/admin-fr";

export interface HealthItem {
  label: string;
  value: string;
  ok: boolean | null; // null = neutral/informational
}

export function SystemHealthPanel({ title, subtitle, items }: { title: string; subtitle?: string; items: HealthItem[] }) {
  const fr = useDashboardLanguage() === "fr";
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
            <span className="text-xs font-medium text-slate-600">{adminFr(item.label, fr)}</span>
            <Badge tone={item.ok === null ? "muted" : item.ok ? "success" : "warning"}>{adminFr(item.value, fr)}</Badge>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
