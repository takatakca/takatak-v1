// Growth Suite — AI Engine catalog (pure data).
//
// The dashboard never calls model providers directly. Every AI task is meant to
// route through the TAKATAK AI Gateway (the owner's own backend, configured with
// TAKATAK_AI_GATEWAY_URL + TAKATAK_AI_GATEWAY_TOKEN), which holds the provider
// keys, picks the model, meters usage and debits client credits. Provider env
// vars listed here are only read for presence on the dashboard host, so the
// owner can see which engines are wired. No generation happens in this layer.

export type AiCapability = "text" | "image" | "video" | "voice" | "search" | "code";

export interface AiProviderDef {
  key: string;
  name: string;
  capabilities: AiCapability[];
  bestFor: string;
  env: string;
}

/**
 * The 13 engines in the TAKATAK AI roster. Edit this list to match the
 * providers the gateway actually runs; order is display order only.
 */
export const AI_PROVIDERS: AiProviderDef[] = [
  { key: "openai", name: "OpenAI", capabilities: ["text", "image", "voice", "code"], bestFor: "General copy, images and voice", env: "OPENAI_API_KEY" },
  { key: "anthropic", name: "Anthropic Claude", capabilities: ["text", "code"], bestFor: "Long-form writing, strategy and agents", env: "ANTHROPIC_API_KEY" },
  { key: "gemini", name: "Google Gemini", capabilities: ["text", "image", "video"], bestFor: "Multimodal briefs and YouTube/Ads context", env: "GEMINI_API_KEY" },
  { key: "mistral", name: "Mistral", capabilities: ["text"], bestFor: "Fast French/English copy", env: "MISTRAL_API_KEY" },
  { key: "xai", name: "xAI Grok", capabilities: ["text"], bestFor: "Trend-aware social copy", env: "XAI_API_KEY" },
  { key: "perplexity", name: "Perplexity", capabilities: ["search", "text"], bestFor: "Cited web research and competitor scans", env: "PERPLEXITY_API_KEY" },
  { key: "deepseek", name: "DeepSeek", capabilities: ["text", "code"], bestFor: "Low-cost bulk generation", env: "DEEPSEEK_API_KEY" },
  { key: "groq", name: "Groq (open models)", capabilities: ["text"], bestFor: "Very low-latency chat replies", env: "GROQ_API_KEY" },
  { key: "cohere", name: "Cohere", capabilities: ["text", "search"], bestFor: "Classification, embeddings and review triage", env: "COHERE_API_KEY" },
  { key: "elevenlabs", name: "ElevenLabs", capabilities: ["voice"], bestFor: "Voice-overs and AI phone voices", env: "ELEVENLABS_API_KEY" },
  { key: "runway", name: "Runway", capabilities: ["video"], bestFor: "Short ad and social video generation", env: "RUNWAYML_API_SECRET" },
  { key: "stability", name: "Stability AI", capabilities: ["image"], bestFor: "Product and ad imagery", env: "STABILITY_API_KEY" },
  { key: "heygen", name: "HeyGen", capabilities: ["video", "voice"], bestFor: "Avatar spokesperson videos", env: "HEYGEN_API_KEY" },
];

export const AI_GATEWAY_ENV = ["TAKATAK_AI_GATEWAY_URL", "TAKATAK_AI_GATEWAY_TOKEN"] as const;

export interface CreditActionDef {
  key: string;
  label: string;
  credits: number;
  module: string;
}

/** Credit cost per AI action. Debited by the gateway, never by the browser. */
export const AI_CREDIT_ACTIONS: CreditActionDef[] = [
  { key: "social_caption", label: "Social caption + hashtags", credits: 1, module: "Social" },
  { key: "multi_platform_post", label: "One post adapted to every platform", credits: 3, module: "Social" },
  { key: "review_reply", label: "Review reply draft", credits: 1, module: "Reputation" },
  { key: "chat_reply", label: "AI chat / WhatsApp reply", credits: 1, module: "Conversations" },
  { key: "ad_copy_set", label: "Ad copy set (5 headlines, 3 descriptions)", credits: 2, module: "Ads" },
  { key: "seo_audit_summary", label: "SEO audit action plan", credits: 2, module: "SEO" },
  { key: "blog_article", label: "SEO blog article (~1,000 words)", credits: 8, module: "Web" },
  { key: "image", label: "Generated image", credits: 4, module: "AI Studio" },
  { key: "voice_over", label: "Voice-over (per minute)", credits: 6, module: "AI Studio" },
  { key: "short_video", label: "Short video (up to 15s)", credits: 25, module: "AI Studio" },
  { key: "monthly_report_summary", label: "Monthly report executive summary", credits: 3, module: "Reports" },
];

export interface CreditPackDef {
  key: string;
  credits: number;
  priceCad: number;
  label: string;
}

/** DRAFT pricing — confirm before enabling Stripe checkout. */
export const AI_CREDIT_PACKS: CreditPackDef[] = [
  { key: "starter", credits: 100, priceCad: 15, label: "Starter" },
  { key: "growth", credits: 500, priceCad: 59, label: "Growth" },
  { key: "pro", credits: 1500, priceCad: 149, label: "Pro" },
  { key: "agency", credits: 5000, priceCad: 399, label: "Agency" },
];

export interface AiAgentDef {
  key: string;
  name: string;
  mission: string;
  triggers: string[];
  connectorKeys: string[];
  creditActionKeys: string[];
}

/** Autopilot agents the gateway can run on a client's behalf, with approval gates. */
export const AI_AGENTS: AiAgentDef[] = [
  {
    key: "social_autopilot",
    name: "Social Autopilot",
    mission: "Plans the week, writes one post per day, adapts it to every platform and queues it for approval.",
    triggers: ["Weekly schedule", "New promotion", "Holiday calendar"],
    connectorKeys: ["takatak_social"],
    creditActionKeys: ["multi_platform_post", "image"],
  },
  {
    key: "review_responder",
    name: "Review Responder",
    mission: "Drafts on-brand replies to every new review and escalates 1–3 star reviews to the owner first.",
    triggers: ["New review imported"],
    connectorKeys: ["google_business_profile", "facebook_reviews"],
    creditActionKeys: ["review_reply"],
  },
  {
    key: "review_requester",
    name: "Review Requester",
    mission: "Sends review requests after each job or visit by SMS, WhatsApp or email and follows up once.",
    triggers: ["Job completed", "Invoice paid"],
    connectorKeys: ["twilio_sms", "whatsapp"],
    creditActionKeys: [],
  },
  {
    key: "chat_concierge",
    name: "Chat Concierge",
    mission: "Answers website chat, Messenger and WhatsApp questions 24/7 and books leads into the pipeline.",
    triggers: ["New conversation"],
    connectorKeys: ["web_chat", "whatsapp", "messenger"],
    creditActionKeys: ["chat_reply"],
  },
  {
    key: "seo_watchdog",
    name: "SEO Watchdog",
    mission: "Audits client sites weekly, flags regressions and writes a prioritized fix list.",
    triggers: ["Weekly schedule", "Website deploy"],
    connectorKeys: ["takatak_site_audit", "search_console", "pagespeed"],
    creditActionKeys: ["seo_audit_summary"],
  },
  {
    key: "ads_optimizer",
    name: "Ads Optimizer",
    mission: "Watches spend and cost-per-lead, proposes budget shifts and fresh ad copy. Never spends without approval.",
    triggers: ["Daily schedule", "CPL above target"],
    connectorKeys: ["google_ads", "meta_ads", "takatak_ads"],
    creditActionKeys: ["ad_copy_set"],
  },
  {
    key: "report_writer",
    name: "Report Writer",
    mission: "Turns the month's numbers into a plain-language client report with next steps.",
    triggers: ["Month end"],
    connectorKeys: ["ga4", "takatak_social", "takatak_ads"],
    creditActionKeys: ["monthly_report_summary"],
  },
];
