import { AiHeader } from "@/components/ai-studio/ai-header";
import { ContentGeneratorForm } from "@/components/ai-studio/content-generator-form";
import { PlannedGeneratorForm } from "@/components/ai-studio/planned-generator-form";
import { ProviderStatusCard } from "@/components/ai-studio/provider-status-card";
import { getBrandVoicesData } from "@/lib/ai/ai-data";
import { DISABLED_REASON_LABELS, readAiStudioConfig } from "@/lib/ai/generation/config";
import { getAiProviderStatuses } from "@/lib/ai/providers";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export const dynamic = "force-dynamic";

const PROVIDER_LABELS = { openai: "OpenAI", anthropic: "Anthropic (Claude)" } as const;

export default async function ContentGeneratorPage() {
  const providers = getAiProviderStatuses();
  const config = readAiStudioConfig();
  const { access } = await getServerAccessContext();
  const canGenerate =
    config.enabled && access.mode === "client_scoped" && hasEffectivePermission(access, "create_content");

  if (canGenerate && config.enabled) {
    const voices = await getBrandVoicesData(access);
    return (
      <div className="space-y-5">
        <AiHeader
          title="Content Generator"
          subtitle="Captions, hashtags, hooks, calls to action, long posts, video ideas and creative briefs in your brand voice. Drafts only — a person reviews before anything is published."
          badges={[{ label: `${PROVIDER_LABELS[config.provider]} · ${config.model}` }, { label: "Drafts only" }]}
        />
        <ContentGeneratorForm
          voices={voices.source === "database" ? voices.voices.map((v) => ({ id: v.id, name: v.name, brandName: v.brandName })) : []}
          providerLabel={`${PROVIDER_LABELS[config.provider]} (${config.model})`}
          dailyLimit={config.dailyLimit}
        />
      </div>
    );
  }

  const reason = !config.enabled
    ? DISABLED_REASON_LABELS[config.reason]
    : access.mode !== "client_scoped"
      ? "Select a client workspace to generate drafts for it."
      : "Your role cannot create content in this workspace.";

  return (
    <div className="space-y-5">
      <AiHeader
        title="Content Generator"
        subtitle="Captions, hashtags, hooks and CTAs in the brand voice. Generation runs only when an administrator enables a provider."
        badges={[{ label: "Generation unavailable", status: "not_configured" }]}
      />
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{reason}</p>
      <PlannedGeneratorForm
        title="Generate content"
        subtitle="Controls are disabled until generation is available."
        fields={[
          { label: "Brand voice", kind: "select", placeholder: "Select voice profile" },
          { label: "Platform", kind: "select", placeholder: "Select platform", options: ["Instagram", "Facebook", "TikTok", "LinkedIn"] },
          { label: "Goal / offer", placeholder: "e.g. promote the weekly special" },
          { label: "Extra context", kind: "textarea", placeholder: "Anything the caption must mention" },
        ]}
        buttonLabel="Generate draft"
        footnote="Outputs are saved as drafts with an honest origin label — never published directly."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {providers.map((p) => <ProviderStatusCard key={p.provider} status={p} />)}
      </div>
    </div>
  );
}
