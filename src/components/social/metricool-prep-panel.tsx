import { PlugZap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { METRICOOL_STATE_LABELS, metricoolToneForState } from "@/lib/integrations/metricool/status";
import type { MetricoolConnectionState } from "@/lib/integrations/metricool/types";

const FUTURE_FUNCTIONS = [
  "Connect accounts",
  "Send approved posts",
  "Sync analytics",
  "Generate reports",
  "View calendar",
];

const STATE_MESSAGES: Record<MetricoolConnectionState, string> = {
  not_configured: "Metricool credentials required",
  configured_untested: "Credentials detected, live API test endpoint not confirmed",
  connected: "Metricool connection verified",
  error: "Last connection test failed — see admin integration page",
  disabled: "Metricool is disabled",
};

/** Honest, state-aware Metricool panel driven by the Phase 6 adapter. */
export function MetricoolPrepPanel({ state }: { state: MetricoolConnectionState }) {
  return (
    <Card>
      <CardHeader
        title="Metricool Preparation"
        subtitle={STATE_MESSAGES[state]}
        action={<Badge tone={metricoolToneForState(state)}>{METRICOOL_STATE_LABELS[state]}</Badge>}
      />
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <PlugZap className="h-4 w-4 text-slate-400" />
          Requires METRICOOL_API_KEY, METRICOOL_ACCOUNT_ID (env vars — names only, values never stored in code).
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {FUTURE_FUNCTIONS.map((fn) => (
            <div key={fn} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700">
              {fn} <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">· After verified connection</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
