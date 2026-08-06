import { TriangleAlert } from "lucide-react";
import { AiHeader } from "@/components/ai-studio/ai-header";
import { ProviderStatusCard } from "@/components/ai-studio/provider-status-card";
import { getAiProviderStatuses } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

export default async function ProviderStatusPage() {
  const providers = getAiProviderStatuses();
  return (
    <div className="space-y-5">
      <AiHeader
        title="AI Provider Status"
        subtitle="Readiness of the AI layer providers. States come from env presence only — no calls are made and no endpoint is guessed."
        badges={[{ label: "Foundation" }]}
      />
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs leading-relaxed text-amber-800">
          No AI generation runs in Phase 9. A provider shows Connected only after a real credentialed,
          documented API call succeeds in its own integration phase.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((p) => <ProviderStatusCard key={p.provider} status={p} />)}
      </div>
    </div>
  );
}
