import { AiHeader } from "@/components/ai-studio/ai-header";
import { AiSourceBanner } from "@/components/ai-studio/ai-source-banner";
import { BrandVoiceCard } from "@/components/ai-studio/brand-voice-card";
import { EmptyState } from "@/components/saas/empty-state";
import { getBrandVoicesData } from "@/lib/ai/ai-data";

export const dynamic = "force-dynamic";

export default async function BrandVoicePage() {
  const data = await getBrandVoicesData();
  return (
    <div className="space-y-5">
      <AiHeader
        title="Brand Voice"
        subtitle="Voice profiles that will feed future AI prompts: tone, audience, keywords, banned phrases, and sample copy. Editing arrives in a later phase."
        badges={[{ label: "Foundation" }]}
      />
      <AiSourceBanner source={data.source} label={data.sourceLabel} />
      {data.voices.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.voices.map((v) => <BrandVoiceCard key={v.id} voice={v} />)}
        </div>
      ) : (
        <EmptyState title="No brand voices yet" description="Voice profiles appear here." />
      )}
    </div>
  );
}
