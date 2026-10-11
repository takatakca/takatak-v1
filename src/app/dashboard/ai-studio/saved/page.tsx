import Link from "next/link";

import { AiHeader } from "@/components/ai-studio/ai-header";
import { AiSourceBanner } from "@/components/ai-studio/ai-source-banner";
import { SavedOutputCard } from "@/components/ai-studio/saved-output-card";
import { EmptyState } from "@/components/saas/empty-state";
import { handoffNotice } from "@/lib/ai/handoff";
import { getSavedOutputsData } from "@/lib/ai/ai-data";

export const dynamic = "force-dynamic";

export default async function SavedOutputsPage({
  searchParams,
}: {
  searchParams: Promise<{ handoff?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.handoff) ? params.handoff[0] : params.handoff;
  const notice = handoffNotice(raw);
  const data = await getSavedOutputsData();
  const canSend = data.source === "database";

  return (
    <div className="space-y-5">
      <AiHeader
        title="Saved Outputs"
        subtitle="Brouillons enregistrés. Un envoi crée une publication en attente d'approbation. Rien n'est publié tout seul."
        badges={[{ label: "Foundation" }, { label: "Templates — not AI", status: "foundation_template" }]}
        actions={
          <Link href="/dashboard/ai-studio/usage" className="text-sm font-medium text-indigo-700 hover:text-indigo-500">
            Utilisation et coût
          </Link>
        }
      />
      <AiSourceBanner source={data.source} label={data.sourceLabel} />
      {notice ? (
        <p
          className={
            notice.tone === "ok"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          }
        >
          {notice.fr}
          <span className="mt-1 block text-xs opacity-80">{notice.en}</span>
        </p>
      ) : null}
      {data.outputs.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.outputs.map((output) => (
            <SavedOutputCard key={output.id} output={output} canSend={canSend} />
          ))}
        </div>
      ) : (
        <EmptyState title="No saved outputs yet" description="Templates and saved content appear here." />
      )}
      <p className="text-xs text-slate-400">
        Les brouillons de la base peuvent être envoyés à l&apos;approbation sociale. Les modèles hors base restent locaux.
        Database drafts can be sent to social approval. Mock templates stay local.
      </p>
    </div>
  );
}
