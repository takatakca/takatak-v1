import Link from "next/link";
import { BookMarked, FileEdit, Mic2, Sparkles, Wand2 } from "lucide-react";
import { AiHeader } from "@/components/ai-studio/ai-header";
import { AiSourceBanner } from "@/components/ai-studio/ai-source-banner";
import { BrandVoiceCard } from "@/components/ai-studio/brand-voice-card";
import { ProviderStatusCard } from "@/components/ai-studio/provider-status-card";
import { SavedOutputCard } from "@/components/ai-studio/saved-output-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AI_JOB_STATUS_LABELS, AI_KIND_LABELS, aiToneForStatus } from "@/lib/ai/status";
import { getAiStudioOverviewData } from "@/lib/ai/ai-data";

export const dynamic = "force-dynamic";

const TOOLS = [
  { label: "Content Generator", href: "/dashboard/ai-studio/content-generator", note: "Captions, hashtags, hooks, CTAs" },
  { label: "Campaign Builder", href: "/dashboard/ai-studio/campaign-builder", note: "Campaign plans and post ideas" },
  { label: "Video Ideas", href: "/dashboard/ai-studio/video-ideas", note: "Reels/TikTok concepts and scripts" },
  { label: "Brand Voice", href: "/dashboard/ai-studio/brand-voice", note: "Voice profiles feeding future prompts" },
  { label: "Saved Outputs", href: "/dashboard/ai-studio/saved", note: "Templates and saved content" },
  { label: "Provider Status", href: "/dashboard/ai-studio/provider-status", note: "OpenAI / TryHolo readiness" },
];

export default async function AiStudioOverviewPage() {
  const data = await getAiStudioOverviewData();
  const kpis = [
    { label: "Brand Voices", value: data.kpis.brandVoices, icon: Mic2 },
    { label: "Saved Outputs", value: data.kpis.savedOutputs, icon: BookMarked },
    { label: "Template Outputs", value: data.kpis.templateOutputs, icon: FileEdit },
    { label: "AI-Generated Outputs", value: data.kpis.aiGeneratedOutputs, icon: Sparkles },
    { label: "Planned AI Jobs", value: data.kpis.plannedJobs, icon: Wand2 },
  ];
  return (
    <div className="space-y-6">
      <AiHeader
        title="AI Studio"
        subtitle="AI content and campaign workspace. AI is a layer inside TAKATAK — no provider is connected and no generation runs yet."
        badges={[{ label: "Foundation" }, { label: "No AI provider connected", status: "not_configured" }]}
      />

      <section aria-label="AI KPIs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Card key={k.label}>
                <CardBody className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-500">{k.label}</p>
                    <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{k.value}</p>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
        <div className="mt-2"><AiSourceBanner source={data.source} label={data.sourceLabel} /></div>
        <p className="mt-1 text-[11px] text-slate-400">
          AI-Generated Outputs is 0 by design — nothing is claimed as AI-generated until a real provider call succeeds.
        </p>
      </section>

      <section className="space-y-3" aria-label="Tools">
        <h2 className="text-sm font-semibold text-slate-900">Studio Tools</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40">
              <p className="text-sm font-semibold text-slate-900">{t.label}</p>
              <p className="text-xs text-slate-500">{t.note}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Provider Readiness</h2>
          {data.providers.map((p) => <ProviderStatusCard key={p.provider} status={p} />)}
        </div>
        <Card>
          <CardHeader title="Planned AI Jobs" subtitle="Planned only — no generation runs in Phase 9." />
          <CardBody className="space-y-2">
            {data.plannedJobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-700">{AI_KIND_LABELS[j.kind] ?? j.kind}: {j.promptSummary ?? "—"}</p>
                  <p className="text-[11px] text-slate-400">{j.brandName ?? "—"}</p>
                </div>
                <Badge tone={aiToneForStatus(j.status)}>{AI_JOB_STATUS_LABELS[j.status] ?? j.status}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>

      <section className="space-y-3" aria-label="Voices and outputs">
        <h2 className="text-sm font-semibold text-slate-900">Brand Voices</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.voices.map((v) => <BrandVoiceCard key={v.id} voice={v} />)}
        </div>
        <h2 className="pt-2 text-sm font-semibold text-slate-900">Recent Saved Outputs</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.recentOutputs.map((o) => <SavedOutputCard key={o.id} output={o} />)}
        </div>
      </section>
    </div>
  );
}
