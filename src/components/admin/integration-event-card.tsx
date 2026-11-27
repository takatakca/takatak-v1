"use client";

import { useDashboardLanguage } from "@/components/layout/dashboard-language";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { adminFr } from "@/lib/admin/admin-fr";
import { EVENT_STATUS_LABELS, adminToneForStatus } from "@/lib/admin/status";
import type { IntegrationEventSummary } from "@/lib/admin/types";

export function IntegrationEventCard({ event }: { event: IntegrationEventSummary }) {
  const fr = useDashboardLanguage() === "fr";
  return (
    <Card>
      <CardBody className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{event.eventType}</h3>
            <p className="text-[11px] text-slate-400">{event.provider} · {event.createdAt}</p>
          </div>
          <Badge tone={adminToneForStatus(event.status)}>{adminFr(EVENT_STATUS_LABELS[event.status] ?? event.status, fr)}</Badge>
        </div>
        {event.errorMessage ? <p className="text-xs text-rose-600">{event.errorMessage}</p> : null}
        <p className="text-[11px] text-slate-400">
          {fr
            ? "Contenu gardé seulement sur le serveur, jamais affiché. Rejouer n’est pas actif."
            : "Payload stored server-side only — never rendered. Replay not active."}
        </p>
      </CardBody>
    </Card>
  );
}
