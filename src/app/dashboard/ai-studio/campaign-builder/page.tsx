import { StudioGeneratorScreen } from "@/components/ai-studio/studio-generator-screen";

export const dynamic = "force-dynamic";

export default function CampaignBuilderPage() {
  return (
    <StudioGeneratorScreen
      title="Planificateur de campagnes · Campaign builder"
      subtitle="Un plan de campagne de 4 semaines : objectif, public, message clé et calendrier de publications. Le plan est gardé comme brouillon ; rien n’est programmé ni publié · A 4-week campaign plan: objective, audience, key message and a post calendar. Saved as a draft; nothing is scheduled or published."
      purpose="Plans de campagne, calendriers de contenu et idées de publications pour votre entreprise · Campaign plans, content calendars and post ideas for your business."
      kinds={["campaign_plan"]}
      formTitle="Bâtir un plan de campagne · Build a campaign plan"
      goalLabel="Objectif de la campagne · Campaign goal"
      goalPlaceholder="ex. : plus de clients le midi en décembre · e.g. more lunch customers in December"
      contextPlaceholder="Type d’entreprise, offre, dates, public visé… · Business type, offer, dates, target audience…"
    />
  );
}
