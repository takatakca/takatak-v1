import { StudioGeneratorScreen } from "@/components/ai-studio/studio-generator-screen";

export const dynamic = "force-dynamic";

export default function VideoIdeasPage() {
  return (
    <StudioGeneratorScreen
      title="Idées vidéo · Video ideas"
      subtitle="Idées de reels et de TikTok, scripts courts et briefs créatifs pour votre équipe ou votre vidéaste. Brouillons à relire · Reel and TikTok ideas, short scripts and creative briefs for your team or videographer. Drafts for review."
      purpose="Concepts de reels et de TikTok, scripts et briefs créatifs · Reel and TikTok concepts, scripts and creative briefs."
      kinds={["video_idea", "video_script", "creative_brief"]}
      formTitle="Créer des idées vidéo · Generate video ideas"
      goalLabel="Sujet ou accroche · Topic / hook"
      goalPlaceholder="ex. : les coulisses de la cuisine le matin · e.g. behind the scenes in the kitchen"
      contextPlaceholder="Durée, ton, ce qu’on doit voir ou dire… · Length, tone, what must be shown or said…"
    />
  );
}
