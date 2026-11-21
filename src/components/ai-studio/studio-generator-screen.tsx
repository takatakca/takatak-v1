import { AiHeader } from "@/components/ai-studio/ai-header";
import { ContentGeneratorForm } from "@/components/ai-studio/content-generator-form";
import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { getBrandVoicesData } from "@/lib/ai/ai-data";
import { DISABLED_REASON_LABELS } from "@/lib/ai/generation/config";
import type { GenerationKind } from "@/lib/ai/generation/prompt";
import { resolveStudioEngine, studioCreditBalance } from "@/lib/ai/generation/studio-engine";
import { trialStatus } from "@/lib/takbot/server";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

const PROVIDER_LABELS = { openai: "OpenAI", anthropic: "Anthropic (Claude)" } as const;

/**
 * One AI Studio generator screen (content, campaigns, video). It works as
 * soon as an engine is available: a provider key set for AI Studio, or the
 * TAK-TAK engines already connected (billed in AI credits). Clients never
 * see a form with disabled controls: without an engine they get the
 * "done by the TAKATAK team" page.
 */
export async function StudioGeneratorScreen({
  title,
  subtitle,
  purpose,
  kinds,
  formTitle,
  goalLabel,
  goalPlaceholder,
  contextPlaceholder,
}: {
  title: string;
  subtitle: string;
  purpose: string;
  kinds?: readonly GenerationKind[];
  formTitle?: string;
  goalLabel?: string;
  goalPlaceholder?: string;
  contextPlaceholder?: string;
}) {
  const [{ access }, engine] = await Promise.all([getServerAccessContext(), resolveStudioEngine()]);
  const canGenerate =
    engine.kind !== "off" && access.mode === "client_scoped" && hasEffectivePermission(access, "create_content");

  if (canGenerate && access.mode === "client_scoped") {
    const [voices, balance, trial] = await Promise.all([
      getBrandVoicesData(access),
      engine.kind === "takbot" ? studioCreditBalance(access.activeClientId) : Promise.resolve(null),
      engine.kind === "takbot" ? trialStatus(access.activeClientId).catch(() => null) : Promise.resolve(null),
    ]);
    // A new workspace can take its free TAK-TAK trial credits from here, once ever.
    const trialCredits = trial && trial.enabled && !trial.claimed && !trial.premium ? trial.credits : null;
    const engineLabel =
      engine.kind === "direct"
        ? `${PROVIDER_LABELS[engine.config.provider]} · ${engine.config.model}`
        : "Moteurs TAK-TAK · TAK-TAK engines";
    return (
      <div className="space-y-5">
        <AiHeader
          title={title}
          subtitle={subtitle}
          badges={[{ label: engine.kind === "direct" ? PROVIDER_LABELS[engine.config.provider] : "TAK-TAK" }, { label: "Brouillons seulement · Drafts only" }]}
        />
        <ContentGeneratorForm
          voices={voices.source === "database" ? voices.voices.map((v) => ({ id: v.id, name: v.name, brandName: v.brandName })) : []}
          engineLabel={engineLabel}
          dailyLimit={engine.dailyLimit}
          kinds={kinds}
          title={formTitle}
          goalLabel={goalLabel}
          goalPlaceholder={goalPlaceholder}
          contextPlaceholder={contextPlaceholder}
          creditsPerDraft={engine.kind === "takbot" ? engine.credits : null}
          initialBalance={balance}
          trialCredits={trialCredits}
        />
      </div>
    );
  }

  // Clients never get a form with every control disabled: they get the team.
  if (access.mode !== "platform_admin") {
    return <ModulePlaceholder def={{ title, purpose, status: "foundation", functions: [] }} />;
  }

  const reason =
    engine.kind === "off"
      ? `${DISABLED_REASON_LABELS[engine.reason]} Aucun moteur TAK-TAK n’est branché non plus · No TAK-TAK engine is connected either.`
      : "Choisissez un espace client pour créer ses brouillons (en haut de l’écran) · Select a client workspace to generate drafts for it.";
  return (
    <div className="space-y-5">
      <AiHeader title={title} subtitle={subtitle} />
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{reason}</p>
    </div>
  );
}
