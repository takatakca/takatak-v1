import Link from "next/link";
import { BookMarked, FileEdit, Mic2, Sparkles, Wand2 } from "lucide-react";
import { AiHeader } from "@/components/ai-studio/ai-header";
import { AiSourceBanner } from "@/components/ai-studio/ai-source-banner";
import { BrandVoiceCard } from "@/components/ai-studio/brand-voice-card";
import { SavedOutputCard } from "@/components/ai-studio/saved-output-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AI_JOB_STATUS_LABELS, AI_KIND_LABELS, aiToneForStatus } from "@/lib/ai/status";
import { getAiStudioOverviewData } from "@/lib/ai/ai-data";
import { STAFF_ONLY_ROUTES } from "@/lib/dashboard/dashboard-config";
import { getServerAccessContext } from "@/lib/security/access-context";
import { TAKBOT_ENGINES } from "@/lib/takbot/catalog";
import { connectedEngines } from "@/lib/takbot/server";

export const dynamic = "force-dynamic";

const TOOLS = [
  { label: "TAKATAKSTUDIO", href: "/dashboard/studio", note: "Scripts vidéo, plans de livre et paroles avec TAK-TAK · Video scripts, outlines and lyrics" },
  { label: "Générateur de contenu · Content generator", href: "/dashboard/ai-studio/content-generator", note: "Légendes, mots-clics, accroches · Captions, hashtags, hooks" },
  { label: "Planificateur de campagnes · Campaign builder", href: "/dashboard/ai-studio/campaign-builder", note: "Plans de campagne sur 4 semaines · 4-week campaign plans" },
  { label: "Idées vidéo · Video ideas", href: "/dashboard/ai-studio/video-ideas", note: "Reels, TikTok et scripts courts · Reels, TikTok and short scripts" },
  { label: "Voix de marque · Brand voice", href: "/dashboard/ai-studio/brand-voice", note: "Votre ton, votre public, vos mots · Your tone, audience and words" },
  { label: "Brouillons · Saved drafts", href: "/dashboard/ai-studio/saved", note: "Envoyer un brouillon à l’approbation · Send a draft for approval" },
  { label: "Utilisation et coût · Usage & cost", href: "/dashboard/ai-studio/usage", note: "Solde de crédits et coût estimé · Credit balance and cost" },
  { label: "Moteurs IA · AI engines", href: "/dashboard/ai-studio/provider-status", note: "Les moteurs branchés en ce moment · Engines connected now" },
];

export default async function AiStudioOverviewPage() {
  const [data, connectedSet] = await Promise.all([getAiStudioOverviewData(), connectedEngines().catch(() => new Set<string>())]);
  const connected = TAKBOT_ENGINES.filter((engine) => connectedSet.has(engine.key)).length;
  const { access } = await getServerAccessContext();
  // Tools that are not self-serve yet stay with the TAKATAK team.
  const tools = access.mode === "platform_admin" ? TOOLS : TOOLS.filter((t) => !STAFF_ONLY_ROUTES.has(t.href));
  const kpis = [
    { label: "Voix de marque · Brand voices", value: data.kpis.brandVoices, icon: Mic2 },
    { label: "Brouillons gardés · Saved drafts", value: data.kpis.savedOutputs, icon: BookMarked },
    { label: "Modèles · Templates", value: data.kpis.templateOutputs, icon: FileEdit },
    { label: "Générés par IA · AI-generated", value: data.kpis.aiGeneratedOutputs, icon: Sparkles },
    { label: "Tâches IA · AI jobs", value: data.kpis.plannedJobs, icon: Wand2 },
  ];
  return (
    <div className="space-y-6">
      <AiHeader
        title="AI Studio"
        subtitle="Publications, légendes et idées dans la voix de votre marque. Les brouillons sont gardés ici et une personne les relit avant toute publication · Posts, captions and ideas in your brand voice, saved as drafts a person reviews before anything is published."
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
      </section>

      <section className="space-y-3" aria-label="Tools">
        <h2 className="text-sm font-semibold text-slate-900">Outils · Tools</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tools.map((t) => (
            <Link key={t.href} href={t.href} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40">
              <p className="text-sm font-semibold text-slate-900">{t.label}</p>
              <p className="text-xs text-slate-500">{t.note}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Moteurs IA · AI engines" subtitle="TAK-TAK choisit le meilleur moteur branché pour chaque brouillon · TAK-TAK picks the best connected engine for each draft." />
          <CardBody className="space-y-2">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">
              {connected} / {TAKBOT_ENGINES.length}
              <span className="ml-2 text-xs font-medium text-slate-500">branchés · connected</span>
            </p>
            <Link href="/dashboard/ai-studio/provider-status" className="text-xs font-semibold text-indigo-700 hover:underline">
              Voir les moteurs · See the engines
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Tâches IA · AI jobs" subtitle="Les demandes récentes d’AI Studio, par marque · Recent AI Studio requests, by brand." />
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
        <h2 className="text-sm font-semibold text-slate-900">Voix de marque · Brand voices</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.voices.map((v) => <BrandVoiceCard key={v.id} voice={v} />)}
        </div>
        <h2 className="pt-2 text-sm font-semibold text-slate-900">Brouillons récents · Recent drafts</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.recentOutputs.map((o) => (
            <SavedOutputCard key={o.id} output={o} canSend={data.source === "database"} />
          ))}
        </div>
      </section>
    </div>
  );
}
