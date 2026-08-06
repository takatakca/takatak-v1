// Phase 9 — AI Studio data access. DB-first, honest mock fallback.
// Never claims "database" unless real queries succeeded. Never crashes pages.
// Nothing here calls any AI provider or generates content.

import { getPrisma } from "@/lib/db/prisma";
import { clientWhere, resolveDataScope } from "@/lib/security/data-scope";
import type { TenantAccess } from "@/lib/security/tenant-access";
import { getAiProviderStatuses } from "./providers";
import type {
  AiJobSummary,
  AiStudioOverviewData,
  BrandVoiceSummary,
  SavedOutputSummary,
  SourceMeta,
} from "./types";

const MOCK_LABEL = "Mock foundation data — database not connected yet.";
const DB_LABEL = "Database — live foundation records (no AI provider connected).";

// ── Mock foundation data (mirrors the seed; templates, NOT AI) ──
const MOCK_VOICES: BrandVoiceSummary[] = [
  {
    id: "m_v1",
    name: "Montreal Restaurant Hub — Friendly Local Voice",
    brandName: "Montreal Restaurant Hub Demo",
    tone: "Warm, local, food-forward, casual",
    audience: "Montreal locals and food lovers",
    language: "en",
    keywords: ["fresh", "local", "weekly special", "family"],
    bannedPhrases: ["cheap", "discount blowout"],
    sampleCaption: "[Foundation template] Fresh from our kitchen this week — come taste what's local.",
    notes: "Foundation seed profile. Refine with the client before any real AI generation.",
  },
  {
    id: "m_v2",
    name: "TAKATAK — Confident SaaS Voice",
    brandName: "TAKATAK Demo Brand",
    tone: "Clear, confident, helpful, no hype",
    audience: "Business owners managing digital services",
    language: "en",
    keywords: ["one dashboard", "control tower", "honest status"],
    bannedPhrases: ["revolutionary", "magic"],
    sampleCaption: "[Foundation template] Every service, one dashboard. See exactly what's running.",
    notes: "Foundation seed profile for TAKATAK's own brand.",
  },
];

const MOCK_OUTPUTS: SavedOutputSummary[] = [
  { id: "m_o1", kind: "caption", title: "Weekly special caption template", contentPreview: "[Foundation template — not AI generated] This week's special: {dish}. Made fresh, made local…", origin: "foundation_template", status: "saved", brandName: "Montreal Restaurant Hub Demo", voiceName: "Montreal Restaurant Hub — Friendly Local Voice", createdAt: "2026-07-14" },
  { id: "m_o2", kind: "video_idea", title: "Behind-the-scenes kitchen video idea template", contentPreview: "[Foundation template — not AI generated] 30s reel: prep shots, sizzle close-up, plate reveal…", origin: "foundation_template", status: "saved", brandName: "Montreal Restaurant Hub Demo", voiceName: "Montreal Restaurant Hub — Friendly Local Voice", createdAt: "2026-07-14" },
  { id: "m_o3", kind: "hook", title: "SaaS awareness hook template", contentPreview: "[Foundation template — not AI generated] Still juggling five dashboards? Here's what one honest…", origin: "foundation_template", status: "saved", brandName: "TAKATAK Demo Brand", voiceName: "TAKATAK — Confident SaaS Voice", createdAt: "2026-07-14" },
];

const MOCK_JOBS: AiJobSummary[] = [
  { id: "m_j1", kind: "caption", status: "planned", provider: null, brandName: "Montreal Restaurant Hub Demo", voiceName: "Montreal Restaurant Hub — Friendly Local Voice", promptSummary: "Weekly special caption in brand voice", createdAt: "2026-07-14" },
  { id: "m_j2", kind: "campaign_plan", status: "planned", provider: null, brandName: "TAKATAK Demo Brand", voiceName: "TAKATAK — Confident SaaS Voice", promptSummary: "SaaS awareness mini campaign plan", createdAt: "2026-07-14" },
];

function preview(text: string): string {
  return text.length > 100 ? `${text.slice(0, 97)}…` : text;
}

function logDbError(scope: string, error: unknown) {
  console.error(`[ai-data:${scope}] Query failed — using mock foundation data:`, error instanceof Error ? error.message : "unknown error");
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// ── Brand voices ─────────────────────────────────────────────
export async function getBrandVoicesData(access?: TenantAccess): Promise<SourceMeta & { voices: BrandVoiceSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, voices: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.brandVoice.findMany({
        where: clientWhere(scope),
        include: { businessBrand: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        voices: rows.map((v) => ({
          id: v.id, name: v.name, brandName: v.businessBrand?.name ?? null,
          tone: v.tone, audience: v.audience, language: v.language,
          keywords: toStringArray(v.keywords), bannedPhrases: toStringArray(v.bannedPhrases),
          sampleCaption: v.sampleCaption, notes: v.notes,
        })),
      };
    } catch (error) {
      logDbError("voices", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", voices: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, voices: MOCK_VOICES };
}

// ── Saved outputs ────────────────────────────────────────────
export async function getSavedOutputsData(access?: TenantAccess): Promise<SourceMeta & { outputs: SavedOutputSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, outputs: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.savedAiOutput.findMany({
        where: clientWhere(scope),
        include: { businessBrand: { select: { name: true } }, brandVoice: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        outputs: rows.map((o) => ({
          id: o.id, kind: o.kind, title: o.title, contentPreview: preview(o.content),
          origin: o.origin, status: o.status,
          brandName: o.businessBrand?.name ?? null, voiceName: o.brandVoice?.name ?? null,
          createdAt: o.createdAt.toISOString().slice(0, 10),
        })),
      };
    } catch (error) {
      logDbError("outputs", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", outputs: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, outputs: MOCK_OUTPUTS };
}

// ── Planned AI jobs ──────────────────────────────────────────
export async function getAiJobsData(access?: TenantAccess): Promise<SourceMeta & { jobs: AiJobSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, jobs: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.aiContentJob.findMany({
        where: clientWhere(scope),
        include: { businessBrand: { select: { name: true } }, brandVoice: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        jobs: rows.map((j) => ({
          id: j.id, kind: j.kind, status: j.status, provider: j.provider,
          brandName: j.businessBrand?.name ?? null, voiceName: j.brandVoice?.name ?? null,
          promptSummary: j.promptSummary,
          createdAt: j.createdAt.toISOString().slice(0, 10),
        })),
      };
    } catch (error) {
      logDbError("jobs", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", jobs: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, jobs: MOCK_JOBS };
}

// ── Overview ─────────────────────────────────────────────────
export async function getAiStudioOverviewData(access?: TenantAccess): Promise<AiStudioOverviewData> {
  const [voices, outputs, jobs] = await Promise.all([
    getBrandVoicesData(access),
    getSavedOutputsData(access),
    getAiJobsData(access),
  ]);
  return {
    source: voices.source,
    sourceLabel: voices.sourceLabel,
    kpis: {
      brandVoices: voices.voices.length,
      savedOutputs: outputs.outputs.length,
      plannedJobs: jobs.jobs.filter((j) => j.status === "planned").length,
      templateOutputs: outputs.outputs.filter((o) => o.origin === "foundation_template").length,
      aiGeneratedOutputs: outputs.outputs.filter((o) => o.origin === "ai_generated").length, // 0 in Phase 9
    },
    voices: voices.voices,
    recentOutputs: outputs.outputs.slice(0, 4),
    plannedJobs: jobs.jobs,
    providers: getAiProviderStatuses(),
  };
}
