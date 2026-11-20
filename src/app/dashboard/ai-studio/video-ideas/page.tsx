import { AiHeader } from "@/components/ai-studio/ai-header";
import { PlannedGeneratorForm } from "@/components/ai-studio/planned-generator-form";
import { SavedOutputCard } from "@/components/ai-studio/saved-output-card";
import { AiSourceBanner } from "@/components/ai-studio/ai-source-banner";
import { getSavedOutputsData } from "@/lib/ai/ai-data";
import { StaffOnly } from "@/components/dashboard/staff-only";

export const dynamic = "force-dynamic";

async function VideoIdeasPageScreen() {
  const data = await getSavedOutputsData();
  const videoOutputs = data.outputs.filter((o) => ["video_idea", "video_script", "creative_brief"].includes(o.kind));
  return (
    <div className="space-y-5">
      <AiHeader
        title="Video Ideas"
        subtitle="Future generator for reels/TikTok concepts, scripts, and creative briefs. Briefs may later be exported to TryHolo — TryHolo stays disabled and the platform never depends on it."
        badges={[{ label: "Foundation" }, { label: "TryHolo disabled", status: "disabled" }]}
      />
      <PlannedGeneratorForm
        title="Generate video concepts (planned)"
        subtitle="All controls are disabled — no AI call happens on this page."
        fields={[
          { label: "Brand", kind: "select", placeholder: "Select brand" },
          { label: "Format", kind: "select", placeholder: "Select format", options: ["15s reel", "30s reel", "60s TikTok"] },
          { label: "Topic / hook", placeholder: "e.g. behind-the-scenes kitchen prep" },
        ]}
        buttonLabel="Generate video ideas"
      />
      <AiSourceBanner source={data.source} label={data.sourceLabel} />
      <div className="grid gap-3 sm:grid-cols-2">
        {videoOutputs.map((o) => (
          <SavedOutputCard key={o.id} output={o} canSend={data.source === "database"} />
        ))}
      </div>
    </div>
  );
}

// Not self-serve for clients yet: TAKATAK staff see the screen, clients see
// what it is for and ask the team (owner's order, Nov 2026: no prototypes).
export default async function VideoIdeasPage() {
  return (
    <StaffOnly
      title="Idées vidéo · Video ideas"
      purpose="Concepts de reels et de TikTok, scripts et briefs créatifs · Reel and TikTok concepts, scripts and creative briefs."
    >
      <VideoIdeasPageScreen />
    </StaffOnly>
  );
}
