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
        subtitle="Your brand voice: tone, audience, keywords, words to avoid and sample copy. AI drafts follow it. To change it, ask the team."
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
