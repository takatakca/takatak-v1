import { AiHeader } from "@/components/ai-studio/ai-header";
import { AiSourceBanner } from "@/components/ai-studio/ai-source-banner";
import { SavedOutputCard } from "@/components/ai-studio/saved-output-card";
import { EmptyState } from "@/components/saas/empty-state";
import { getSavedOutputsData } from "@/lib/ai/ai-data";

export const dynamic = "force-dynamic";

export default async function SavedOutputsPage() {
  const data = await getSavedOutputsData();
  return (
    <div className="space-y-5">
      <AiHeader
        title="Saved Outputs"
        subtitle="Saved AI Studio content with honest provenance. Everything below is a foundation template written by TAKATAK — nothing is AI-generated yet."
        badges={[{ label: "Foundation" }, { label: "Templates — not AI", status: "foundation_template" }]}
      />
      <AiSourceBanner source={data.source} label={data.sourceLabel} />
      {data.outputs.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.outputs.map((o) => <SavedOutputCard key={o.id} output={o} />)}
        </div>
      ) : (
        <EmptyState title="No saved outputs yet" description="Templates and saved content appear here." />
      )}
      <p className="text-xs text-slate-400">
        Sending outputs to the approval workflow activates in a later phase — no send actions exist yet.
      </p>
    </div>
  );
}
