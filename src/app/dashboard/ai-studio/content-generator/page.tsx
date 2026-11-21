import { StudioGeneratorScreen } from "@/components/ai-studio/studio-generator-screen";

export const dynamic = "force-dynamic";

export default function ContentGeneratorPage() {
  return (
    <StudioGeneratorScreen
      title="Générateur de contenu · Content generator"
      subtitle="Légendes, mots-clics, accroches, appels à l’action, publications longues et briefs dans la voix de votre marque. Brouillons seulement : une personne relit avant toute publication · Captions, hashtags, hooks, calls to action, long posts and briefs in your brand voice. Drafts only: a person reviews before anything is published."
      purpose="Légendes, mots-clics, accroches et appels à l’action dans la voix de votre marque · Captions, hashtags, hooks and calls to action in your brand voice."
      kinds={["caption", "hashtags", "hook", "cta", "post_long", "creative_brief"]}
    />
  );
}
