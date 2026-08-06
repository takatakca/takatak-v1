import { AiHeader } from "@/components/ai-studio/ai-header";
import { PlannedGeneratorForm } from "@/components/ai-studio/planned-generator-form";
import { ProviderStatusCard } from "@/components/ai-studio/provider-status-card";
import { getAiProviderStatuses } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

export default async function ContentGeneratorPage() {
  const providers = getAiProviderStatuses();
  return (
    <div className="space-y-5">
      <AiHeader
        title="Content Generator"
        subtitle="Future generator for captions, hashtags, hooks, and CTAs in the brand voice. The input structure below is the foundation — generation activates only after a verified provider connection."
        badges={[{ label: "Foundation" }, { label: "No AI provider connected", status: "not_configured" }]}
      />
      <PlannedGeneratorForm
        title="Generate content (planned)"
        subtitle="All controls are disabled — no AI call happens on this page."
        fields={[
          { label: "Brand", kind: "select", placeholder: "Select brand", options: ["Montreal Restaurant Hub Demo", "TAKATAK Demo Brand"] },
          { label: "Brand voice", kind: "select", placeholder: "Select voice profile" },
          { label: "Platform", kind: "select", placeholder: "Select platform", options: ["Instagram", "Facebook", "TikTok", "LinkedIn"] },
          { label: "Goal / offer", placeholder: "e.g. promote the weekly special" },
          { label: "Extra context", kind: "textarea", placeholder: "Anything the caption must mention" },
        ]}
        buttonLabel="Generate caption"
        footnote="Outputs will be saved with an honest origin label and routed into the Phase 5 approval workflow — never published directly."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((p) => <ProviderStatusCard key={p.provider} status={p} />)}
      </div>
    </div>
  );
}
