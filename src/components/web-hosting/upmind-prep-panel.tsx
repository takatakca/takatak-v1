import { PlugZap, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { UPMIND_STATE_LABELS, UPMIND_STATE_MESSAGES, upmindToneForState } from "@/lib/integrations/upmind/status";
import type { UpmindConnectionState } from "@/lib/integrations/upmind/types";

const FUTURE_FUNCTIONS = [
  "Domain search",
  "Hosting plan cards",
  "Product catalogue",
  "Client portal",
  "Invoices",
  "Provisioning automation",
  "Service desk",
  "Webhooks",
];

/** Honest, state-aware Upmind panel driven by the Phase 8 adapter. */
export function UpmindPrepPanel({ state }: { state: UpmindConnectionState }) {
  return (
    <Card>
      <CardHeader
        title="Upmind Preparation"
        subtitle={UPMIND_STATE_MESSAGES[state]}
        action={<Badge tone={upmindToneForState(state)}>{UPMIND_STATE_LABELS[state]}</Badge>}
      />
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <PlugZap className="h-4 w-4 text-slate-400" />
          Requires UPMIND_API_KEY, UPMIND_API_BASE_URL, UPMIND_WEBHOOK_SECRET (env vars — names only).
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {FUTURE_FUNCTIONS.map((fn) => (
            <div key={fn} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700">
              {fn} <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">· After verified connection</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] leading-relaxed text-amber-800">
            No Upmind API calls, domain registration, or hosting provisioning are active. Nothing activates without a verified connection.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
