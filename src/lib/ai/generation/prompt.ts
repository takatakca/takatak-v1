// AI Studio prompts: whitelisted content kinds and platforms, bounded inputs,
// brand voice applied as instructions. Pure module.

export const GENERATION_KINDS = {
  caption: { label: "Social caption", labelFr: "Légende de publication", instruction: "Write one social media caption (max 120 words). No hashtags unless asked." },
  hashtags: { label: "Hashtags", labelFr: "Mots-clics", instruction: "Suggest 12 relevant hashtags, one per line, mixing broad and local/niche tags." },
  hook: { label: "Hooks", labelFr: "Accroches", instruction: "Write 5 short opening hooks (max 15 words each), one per line." },
  cta: { label: "Calls to action", labelFr: "Appels à l’action", instruction: "Write 5 short calls to action, one per line." },
  post_long: { label: "Long post", labelFr: "Publication longue", instruction: "Write one long-form post (150–300 words) with short paragraphs." },
  campaign_plan: {
    label: "Campaign plan",
    labelFr: "Plan de campagne",
    instruction:
      "Write a 4-week campaign plan: objective, audience, key message, then a week-by-week calendar with 3 post ideas per week (format, hook, one-line caption idea), and the call to action. Use only the offer, dates and facts given; mark anything to confirm as \"to confirm\".",
  },
  video_idea: { label: "Video ideas", labelFr: "Idées vidéo", instruction: "Suggest 5 short-video ideas: a title line, then one sentence each." },
  video_script: {
    label: "Video script",
    labelFr: "Script vidéo",
    instruction:
      "Write one short-video script of 30 to 45 seconds: the hook (first 3 seconds), then 4 to 6 scenes, each with what is shown, what is said and the on-screen text, and the closing call to action.",
  },
  creative_brief: { label: "Creative brief", labelFr: "Brief créatif", instruction: "Write a one-page creative brief: objective, audience, key message, tone, deliverables, mandatory mentions." },
} as const;

export type GenerationKind = keyof typeof GENERATION_KINDS;

export const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "Google Business Profile", "Website", "Email"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface GenerateRequest {
  kind: GenerationKind;
  platform: Platform;
  language: "en" | "fr";
  goal: string;
  context: string | null;
  brandVoiceId: string | null;
}

export interface VoiceForPrompt {
  name: string;
  tone: string | null;
  audience: string | null;
  keywords: string[];
  bannedPhrases: string[];
  sampleCaption: string | null;
  notes: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clean(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (text.length > max) return undefined;
  return text || null;
}

export function parseGenerateRequest(body: unknown): GenerateRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = body as Record<string, unknown>;
  if (typeof raw.kind !== "string" || !Object.hasOwn(GENERATION_KINDS, raw.kind)) return null;
  if (!PLATFORMS.includes(raw.platform as Platform)) return null;
  const goal = clean(raw.goal, 500);
  const context = clean(raw.context, 2000);
  if (!goal || context === undefined) return null;
  let brandVoiceId: string | null = null;
  if (raw.brandVoiceId !== undefined && raw.brandVoiceId !== null && raw.brandVoiceId !== "") {
    if (typeof raw.brandVoiceId !== "string" || !UUID_RE.test(raw.brandVoiceId)) return null;
    brandVoiceId = raw.brandVoiceId;
  }
  return {
    kind: raw.kind as GenerationKind,
    platform: raw.platform as Platform,
    language: raw.language === "fr" ? "fr" : "en",
    goal,
    context,
    brandVoiceId,
  };
}

export function buildPrompt(request: GenerateRequest, voice: VoiceForPrompt | null): { system: string; user: string } {
  const kind = GENERATION_KINDS[request.kind];
  const system = [
    "You write marketing content for a small or medium business, prepared by the TAKATAK agency.",
    "The text is a draft that a person will review before anything is published.",
    `Write in ${request.language === "fr" ? "Canadian French" : "Canadian English"}.`,
    `Platform: ${request.platform}. Respect its usual length and style.`,
    "Never invent prices, dates, addresses, phone numbers, awards, reviews or guarantees that are not in the brief.",
    "Return only the content itself: no preamble, no explanation, no quotation marks around it.",
    voice
      ? [
          `Brand voice "${voice.name}":`,
          voice.tone ? `- Tone: ${voice.tone}` : null,
          voice.audience ? `- Audience: ${voice.audience}` : null,
          voice.keywords.length ? `- Prefer these words: ${voice.keywords.join(", ")}` : null,
          voice.bannedPhrases.length ? `- Never use: ${voice.bannedPhrases.join(", ")}` : null,
          voice.notes ? `- Notes: ${voice.notes}` : null,
          voice.sampleCaption ? `- Example of the voice: ${voice.sampleCaption}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    `Task: ${kind.instruction}`,
    `Goal / offer: ${request.goal}`,
    request.context ? `Context from the team:\n${request.context}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}

export function outputTitle(request: GenerateRequest): string {
  return `${GENERATION_KINDS[request.kind].label} · ${request.platform} · ${request.goal}`.slice(0, 160);
}
