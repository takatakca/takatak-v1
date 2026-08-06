import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PROVISIONING_STATUS_LABELS, webToneForStatus } from "@/lib/web-hosting/status";
import type { ProvisioningStepSummary } from "@/lib/web-hosting/types";

/** Timeline grouped by hosting service. Display only — no retry buttons,
 *  because no workers exist yet. */
export function ProvisioningTimeline({ steps }: { steps: ProvisioningStepSummary[] }) {
  const groups = new Map<string, ProvisioningStepSummary[]>();
  for (const s of steps) {
    const list = groups.get(s.groupName) ?? [];
    list.push(s);
    groups.set(s.groupName, list);
  }
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([group, items]) => (
        <Card key={group}>
          <CardHeader title={group} subtitle="Internal foundation timeline — no real provider provisioning is active." />
          <CardBody>
            <ol className="space-y-3">
              {items.sort((a, b) => a.order - b.order).map((s, i) => (
                <li key={s.id} className="relative flex items-start gap-3">
                  <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
                    <span className={`h-2.5 w-2.5 rounded-full ${s.status === "completed_internal" ? "bg-emerald-500" : s.status === "failed" ? "bg-rose-500" : s.status === "pending" || s.status === "in_progress" ? "bg-amber-400" : "bg-slate-300"}`} />
                    {i < items.length - 1 ? <span className="absolute left-1/2 top-3 h-6 w-px -translate-x-1/2 bg-slate-200" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-800">{s.title}</p>
                      <Badge tone={webToneForStatus(s.status)}>{PROVISIONING_STATUS_LABELS[s.status] ?? s.status}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {s.completedAt ? `Completed (internal) ${s.completedAt}` : s.startedAt ? `Started ${s.startedAt}` : s.plannedAt ? `Planned ${s.plannedAt}` : "No dates yet"}
                      {s.errorMessage ? ` · Error: ${s.errorMessage}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
