import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ModuleHeader } from "@/components/saas/module-header";
import { MetricoolTestPanel } from "@/components/integrations/metricool-test-panel";
import { getMetricoolEnvStatus } from "@/lib/integrations/metricool/env";
import { getMetricoolReadiness } from "@/lib/integrations/metricool/metricool-service";
import { METRICOOL_STATE_LABELS, metricoolToneForState } from "@/lib/integrations/metricool/status";

export const dynamic = "force-dynamic";

const CREDENTIALS: { name: string; required: boolean }[] = [
  { name: "METRICOOL_API_KEY", required: true },
  { name: "METRICOOL_ACCOUNT_ID", required: true },
  { name: "METRICOOL_API_BASE_URL", required: false },
  { name: "METRICOOL_TEST_ENDPOINT", required: false },
  { name: "METRICOOL_WHITE_LABEL_BASE_URL", required: false },
];

const CAPABILITIES = [
  { name: "Account mapping", phase: "Phase 6/7" },
  { name: "Send approved posts", phase: "Post-verification" },
  { name: "Sync analytics", phase: "Post-verification" },
  { name: "Reports", phase: "Phase 12" },
  { name: "Calendar", phase: "Post-verification" },
  { name: "White-label view", phase: "Later" },
];

export default async function AdminMetricoolPage() {
  const env = getMetricoolEnvStatus();
  const readiness = await getMetricoolReadiness();
  const present = (name: string) => {
    switch (name) {
      case "METRICOOL_API_KEY": return env.configured || !env.missing.includes(name);
      case "METRICOOL_ACCOUNT_ID": return env.configured || !env.missing.includes(name);
      case "METRICOOL_API_BASE_URL": return env.hasApiBaseUrl;
      case "METRICOOL_TEST_ENDPOINT": return env.hasTestEndpoint;
      case "METRICOOL_WHITE_LABEL_BASE_URL": return env.hasWhiteLabelUrl;
      default: return false;
    }
  };
  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Metricool Integration"
        description={readiness.message}
        statuses={[]}
        actions={<Badge tone={metricoolToneForState(readiness.state)}>{METRICOOL_STATE_LABELS[readiness.state]}</Badge>}
      />

      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs leading-relaxed text-amber-800">
          No publishing or analytics sync is active in Phase 6. Endpoints are never guessed —
          the API base URL and test endpoint stay empty until confirmed from official Metricool documentation.
        </p>
      </div>

      <Card>
        <CardHeader title="Credential checklist" subtitle="Presence only — values are never displayed or logged." />
        <CardBody className="divide-y divide-slate-100 p-0">
          {CREDENTIALS.map((c) => (
            <div key={c.name} className="flex items-center gap-3 px-5 py-2.5">
              <code className="flex-1 text-xs text-slate-700">{c.name}</code>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{c.required ? "Required" : "Optional"}</span>
              <Badge tone={present(c.name) ? "success" : "warning"}>{present(c.name) ? "Present" : "Missing"}</Badge>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Test connection" subtitle="Runs a real request only when the full live-test environment is configured." />
        <CardBody>
          <MetricoolTestPanel />
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Capability roadmap" subtitle="Everything below activates only after a verified connection." />
          <CardBody className="grid gap-2 sm:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <div key={c.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700">
                {c.name} <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">· {c.phase}</span>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Planned jobs" subtitle="Planned only — no workers run in Phase 6." />
          <CardBody className="space-y-2">
            {["send_to_metricool", "sync_analytics"].map((j) => (
              <div key={j} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                <code className="text-xs text-slate-700">{j}</code>
                <Badge tone="accent">Planned</Badge>
              </div>
            ))}
            {readiness.dbSource === "database" && readiness.dbAccounts.length ? (
              <p className="text-[11px] text-slate-400">
                DB integration accounts: {readiness.dbAccounts.map((a) => `${a.clientName} (${a.status.replaceAll("_", " ")})`).join(", ")}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">Database integration records appear here when the DB is configured.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
