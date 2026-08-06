import { AiHeader } from "@/components/ai-studio/ai-header";
import { PlannedGeneratorForm } from "@/components/ai-studio/planned-generator-form";

export const dynamic = "force-dynamic";

export default async function CampaignBuilderPage() {
  return (
    <div className="space-y-5">
      <AiHeader
        title="Campaign Builder"
        subtitle="Future assistant that drafts campaign plans, content calendars, and post ideas. Drafts will flow into the Social Media module as campaign drafts — nothing is sent to Metricool."
        badges={[{ label: "Foundation" }, { label: "No AI provider connected", status: "not_configured" }]}
      />
      <PlannedGeneratorForm
        title="Build a campaign plan (planned)"
        subtitle="All controls are disabled — no AI call happens on this page."
        fields={[
          { label: "Business type", placeholder: "e.g. restaurant, dental clinic, gym" },
          { label: "Goal", kind: "select", placeholder: "Select goal", options: ["Awareness", "Foot traffic", "Leads", "Launch"] },
          { label: "Date range", placeholder: "e.g. 4 weeks starting next Monday" },
          { label: "Platforms", placeholder: "e.g. Instagram + Facebook" },
          { label: "Offer / audience notes", kind: "textarea", placeholder: "Key offer and target audience" },
        ]}
        buttonLabel="Draft campaign plan"
        footnote="Generated plans will save as campaign drafts for review — real scheduling and publishing stay behind the Metricool verification boundary."
      />
    </div>
  );
}
