import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { AI_PROVIDER_STATE_LABELS, aiToneForStatus } from "@/lib/ai/status";
import type { AiProviderStatus } from "@/lib/ai/types";

const PROVIDER_META: Record<string, { name: string; purpose: string }> = {
  openai: { name: "OpenAI", purpose: "Internal AI assistant + content generation (future)" },
  tryholo: { name: "TryHolo", purpose: "Optional creative AI provider — the platform never depends on it" },
};

export function ProviderStatusCard({ status }: { status: AiProviderStatus }) {
  const meta = PROVIDER_META[status.provider];
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{meta.name}</h3>
            <p className="text-xs text-slate-500">{meta.purpose}</p>
          </div>
          <Badge tone={aiToneForStatus(status.state)}>{AI_PROVIDER_STATE_LABELS[status.state]}</Badge>
        </div>
        <p className="text-xs text-slate-500">{status.message}</p>
        {status.missing.length ? (
          <p className="font-mono text-[11px] text-slate-400">Missing: {status.missing.join(", ")}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
