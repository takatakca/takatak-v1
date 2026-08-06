// Phase 9 — AI Studio view types (serializable, UI-facing).
export type DataSource = "database" | "mock" | "unavailable";

export interface SourceMeta {
  source: DataSource;
  sourceLabel: string;
}

export type AiProviderState =
  | "not_configured"
  | "configured_untested"
  | "connected" // reserved: only after a real tested provider call succeeds
  | "error"
  | "disabled";

export interface AiProviderStatus {
  provider: "openai" | "tryholo";
  state: AiProviderState;
  configured: boolean;
  enabled: boolean; // TryHolo flag; OpenAI always "enabled" conceptually
  missing: string[];
  message: string;
}

export interface BrandVoiceSummary {
  id: string;
  name: string;
  brandName: string | null;
  tone: string | null;
  audience: string | null;
  language: string;
  keywords: string[];
  bannedPhrases: string[];
  sampleCaption: string | null;
  notes: string | null;
}

export interface AiJobSummary {
  id: string;
  kind: string;
  status: string;
  provider: string | null;
  brandName: string | null;
  voiceName: string | null;
  promptSummary: string | null;
  createdAt: string;
}

export interface SavedOutputSummary {
  id: string;
  kind: string;
  title: string;
  contentPreview: string;
  origin: string; // foundation_template | manual | ai_generated (future)
  status: string;
  brandName: string | null;
  voiceName: string | null;
  createdAt: string;
}

export interface AiStudioKpis {
  brandVoices: number;
  savedOutputs: number;
  plannedJobs: number;
  templateOutputs: number;
  aiGeneratedOutputs: number; // 0 in Phase 9 — nothing is AI generated
}

export interface AiStudioOverviewData extends SourceMeta {
  kpis: AiStudioKpis;
  voices: BrandVoiceSummary[];
  recentOutputs: SavedOutputSummary[];
  plannedJobs: AiJobSummary[];
  providers: AiProviderStatus[];
}
