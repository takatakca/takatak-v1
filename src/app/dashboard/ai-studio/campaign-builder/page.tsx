import { AiHeader } from "@/components/ai-studio/ai-header";
import { PlannedGeneratorForm } from "@/components/ai-studio/planned-generator-form";
import { StaffOnly } from "@/components/dashboard/staff-only";

export const dynamic = "force-dynamic";

async function CampaignBuilderPageScreen() {
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

// Not self-serve for clients yet: TAKATAK staff see the screen, clients see
// what it is for and ask the team (owner's order, Nov 2026: no prototypes).
export default async function CampaignBuilderPage() {
  return (
    <StaffOnly
      title="Planificateur de campagnes · Campaign builder"
      purpose="Plans de campagne, calendriers de contenu et idées de publications pour votre entreprise · Campaign plans, content calendars and post ideas for your business."
    >
      <CampaignBuilderPageScreen />
    </StaffOnly>
  );
}
