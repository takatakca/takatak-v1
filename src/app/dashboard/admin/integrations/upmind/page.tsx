import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ModuleHeader } from "@/components/saas/module-header";
import { UpmindTestPanel } from "@/components/integrations/upmind-test-panel";
import { getUpmindEnvStatus } from "@/lib/integrations/upmind/env";
import { getUpmindReadiness } from "@/lib/integrations/upmind/upmind-service";
import { UPMIND_STATE_LABELS, upmindToneForState } from "@/lib/integrations/upmind/status";

export const dynamic = "force-dynamic";

const CREDENTIALS: { name: string; required: boolean }[] = [
  { name: "UPMIND_API_KEY", required: true },
  { name: "UPMIND_API_BASE_URL", required: true },
  { name: "UPMIND_TEST_ENDPOINT", required: false },
  { name: "UPMIND_WEBHOOK_SECRET", required: false },
  { name: "UPMIND_WEBHOOK_ENABLED", required: false },
];

const CAPABILITIES = [
  "Domain search", "Hosting plan cards", "Product catalogue", "Client services",
  "Invoices", "Provisioning automation", "Service desk", "Webhooks", "Headless client portal (later)",
];

const PLANNED_JOBS = ["product sync", "client service sync", "invoice sync", "provisioning sync", "domain status sync"];

export default async function AdminUpmindPage() {
  const env = getUpmindEnvStatus();
  const readiness = await getUpmindReadiness();
  const present = (name: string) => {
    switch (name) {
      case "UPMIND_API_KEY":
      case "UPMIND_API_BASE_URL":
        return !env.missing.includes(name);
      case "UPMIND_TEST_ENDPOINT": return env.hasTestEndpoint;
      case "UPMIND_WEBHOOK_SECRET": return env.hasWebhookSecret;
      case "UPMIND_WEBHOOK_ENABLED": return env.webhookEnabled;
      default: return false;
    }
  };
  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Upmind Integration"
        description={readiness.message}
        statuses={[]}
        actions={<Badge tone={upmindToneForState(readiness.state)}>{UPMIND_STATE_LABELS[readiness.state]}</Badge>}
      />

      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs leading-relaxed text-amber-800">
          No domain registration, DNS editing, SSL installation, invoice sync, or hosting provisioning
          is active in Phase 8. Endpoints are never guessed — base URL and test endpoint stay empty until
          confirmed from official Upmind documentation.
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Test connection" subtitle="Runs a real request only when the full live-test environment is configured." />
          <CardBody><UpmindTestPanel /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Webhook readiness" subtitle="Events are never trusted in Phase 8." />
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              Webhooks: <Badge tone={env.webhookEnabled ? "accent" : "muted"}>{env.webhookEnabled ? "Enabled" : "Disabled"}</Badge>
              Secret: <Badge tone={env.hasWebhookSecret ? "success" : "warning"}>{env.hasWebhookSecret ? "Present" : "Missing"}</Badge>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Signature verification rules must be confirmed from official Upmind docs before events are trusted.
              Until then, received events are recorded as ignored and never processed.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Capability roadmap" subtitle="Everything below activates only after a verified connection." />
          <CardBody className="grid gap-2 sm:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <div key={c} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700">
                {c}
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Planned jobs" subtitle="Planned only — no workers run in Phase 8." />
          <CardBody className="space-y-2">
            {PLANNED_JOBS.map((j) => (
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
