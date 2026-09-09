// Phase 5 — Social module data access. DB-first, honest mock fallback.
// Never claims "database" unless real queries succeeded. Never crashes pages.

import { analyticsHistoryCutoffForClient } from "@/lib/billing/social/entitlement-gates";
import { getPrisma } from "@/lib/db/prisma";
import { clientWhere, resolveDataScope } from "@/lib/security/data-scope";
import type { TenantAccess } from "@/lib/security/tenant-access";
import type {
  AnalyticsSummary,
  ApprovalSummary,
  CalendarItem,
  CampaignSummary,
  PostSummary,
  SocialAccountCard,
  SocialOverviewData,
  SourceMeta,
} from "./types";

const MOCK_LABEL = "Mock foundation data — database not connected yet.";
const DB_LABEL = "Database — live foundation records (Metricool not connected).";

// ── Typed mock foundation data (mirrors the seed, clearly fake) ──
const MOCK_ACCOUNTS: SocialAccountCard[] = [
  { id: "m_fb", platform: "facebook", handle: null, displayName: null, status: "not_connected", brandName: "Montreal Restaurant Hub Demo", lastSyncAt: null },
  { id: "m_ig", platform: "instagram", handle: null, displayName: null, status: "not_connected", brandName: "Montreal Restaurant Hub Demo", lastSyncAt: null },
  { id: "m_tt", platform: "tiktok", handle: null, displayName: null, status: "not_connected", brandName: "Montreal Restaurant Hub Demo", lastSyncAt: null },
  { id: "m_gb", platform: "google_business", handle: null, displayName: null, status: "pending_connection", brandName: "Montreal Restaurant Hub Demo", lastSyncAt: null },
  { id: "m_li", platform: "linkedin", handle: null, displayName: null, status: "not_connected", brandName: "TAKATAK Demo Brand", lastSyncAt: null },
  { id: "m_x", platform: "x", handle: null, displayName: null, status: "disabled", brandName: "TAKATAK Demo Brand", lastSyncAt: null },
];

const MOCK_CAMPAIGNS: CampaignSummary[] = [
  { id: "m_c1", name: "Restaurant Weekly Promo Foundation", goal: "Weekly menu/social campaign", status: "planned", brandName: "Montreal Restaurant Hub Demo", startsAt: null, endsAt: null, postCount: 3 },
  { id: "m_c2", name: "TAKATAK SaaS Awareness Foundation", goal: "Introduce TAKATAK service dashboard", status: "draft", brandName: "TAKATAK Demo Brand", startsAt: null, endsAt: null, postCount: 1 },
];

const MOCK_POSTS: PostSummary[] = [
  { id: "m_p1", platform: "instagram", captionPreview: "[Foundation draft] This week's featured dish — placeholder caption…", status: "draft", campaignName: "Restaurant Weekly Promo Foundation", brandName: "Montreal Restaurant Hub Demo", scheduledAt: null, approvalStatus: null },
  { id: "m_p2", platform: "facebook", captionPreview: "[Foundation] Weekend special announcement — awaiting client approval.", status: "pending_approval", campaignName: "Restaurant Weekly Promo Foundation", brandName: "Montreal Restaurant Hub Demo", scheduledAt: null, approvalStatus: "pending" },
  { id: "m_p3", platform: "linkedin", captionPreview: "[Foundation approved] One dashboard for all your business services…", status: "approved", campaignName: "TAKATAK SaaS Awareness Foundation", brandName: "TAKATAK Demo Brand", scheduledAt: null, approvalStatus: null },
  { id: "m_p4", platform: "tiktok", captionPreview: "[Foundation draft — video idea] Behind-the-scenes kitchen prep concept…", status: "draft", campaignName: "Restaurant Weekly Promo Foundation", brandName: "Montreal Restaurant Hub Demo", scheduledAt: null, approvalStatus: null },
];

const MOCK_APPROVALS: ApprovalSummary[] = [
  { id: "m_a1", status: "pending", comments: "Foundation seed — awaiting client review.", requestedAt: "2026-07-10", postCaptionPreview: "[Foundation] Weekend special announcement — awaiting client approval.", postPlatform: "facebook", brandName: "Montreal Restaurant Hub Demo" },
];

function preview(caption: string): string {
  return caption.length > 80 ? `${caption.slice(0, 77)}…` : caption;
}

function logDbError(scope: string, error: unknown) {
  console.error(`[social-data:${scope}] Query failed — using mock foundation data:`, error instanceof Error ? error.message : "unknown error");
}

function mockPipeline() {
  return { draft: 2, pending_approval: 1, approved: 1, scheduled: 0, published: 0, failed: 0, blocked_by_plan: 0 };
}

// ── Overview ─────────────────────────────────────────────────
export async function getSocialOverviewData(access?: TenantAccess): Promise<SocialOverviewData> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, kpis: { socialAccounts: 0, campaigns: 0, draftPosts: 0, pendingApprovals: 0, approvedPosts: 0 }, accounts: [], campaigns: [], pipeline: mockPipelineZero(), pendingApprovals: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const [accounts, campaigns, statusGroups, pendingApprovals] = await Promise.all([
        prisma.socialAccount.findMany({ where: clientWhere(scope), include: { businessBrand: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
        prisma.campaign.findMany({ where: clientWhere(scope), include: { businessBrand: { select: { name: true } }, _count: { select: { posts: true } } }, orderBy: { createdAt: "asc" } }),
        prisma.socialPost.groupBy({ where: clientWhere(scope), by: ["status"], _count: { _all: true } }),
        prisma.approval.findMany({
          where: { status: "pending", ...clientWhere(scope) },
          include: { socialPost: { select: { caption: true, platform: true } }, businessBrand: { select: { name: true } } },
          orderBy: { requestedAt: "desc" },
          take: 5,
        }),
      ]);
      const pipeline = mockPipelineZero();
      for (const g of statusGroups) pipeline[g.status as keyof typeof pipeline] = g._count._all;
      return {
        source: "database",
        sourceLabel: DB_LABEL,
        kpis: {
          socialAccounts: accounts.length,
          campaigns: campaigns.length,
          draftPosts: pipeline.draft,
          pendingApprovals: pendingApprovals.length,
          approvedPosts: pipeline.approved,
        },
        accounts: accounts.map((a) => ({
          id: a.id, platform: a.platform, handle: a.handle, displayName: a.displayName,
          status: a.status, brandName: a.businessBrand?.name ?? null,
          lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
        })),
        campaigns: campaigns.map((c) => ({
          id: c.id, name: c.name, goal: c.goal, status: c.status,
          brandName: c.businessBrand?.name ?? null,
          startsAt: c.startsAt?.toISOString().slice(0, 10) ?? null,
          endsAt: c.endsAt?.toISOString().slice(0, 10) ?? null,
          postCount: c._count.posts,
        })),
        pipeline,
        pendingApprovals: pendingApprovals.map((a) => ({
          id: a.id, status: a.status, comments: a.comments,
          requestedAt: a.requestedAt.toISOString().slice(0, 10),
          postCaptionPreview: preview(a.socialPost.caption),
          postPlatform: a.socialPost.platform,
          brandName: a.businessBrand?.name ?? null,
        })),
      };
    } catch (error) {
      logDbError("overview", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", kpis: { socialAccounts: 0, campaigns: 0, draftPosts: 0, pendingApprovals: 0, approvedPosts: 0 }, accounts: [], campaigns: [], pipeline: mockPipelineZero(), pendingApprovals: [] };
      }
    }
  }
  return {
    source: "mock",
    sourceLabel: MOCK_LABEL,
    kpis: { socialAccounts: 6, campaigns: 2, draftPosts: 2, pendingApprovals: 1, approvedPosts: 1 },
    accounts: MOCK_ACCOUNTS,
    campaigns: MOCK_CAMPAIGNS,
    pipeline: mockPipeline(),
    pendingApprovals: MOCK_APPROVALS,
  };
}

function mockPipelineZero() {
  return { draft: 0, pending_approval: 0, approved: 0, scheduled: 0, published: 0, failed: 0, blocked_by_plan: 0 };
}

// ── Accounts ─────────────────────────────────────────────────
export async function getSocialAccountsData(access?: TenantAccess): Promise<SourceMeta & { accounts: SocialAccountCard[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, accounts: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const accounts = await prisma.socialAccount.findMany({
        where: clientWhere(scope),
        include: { businessBrand: { select: { name: true } } },
        orderBy: [{ businessBrandId: "asc" }, { platform: "asc" }],
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        accounts: accounts.map((a) => ({
          id: a.id, platform: a.platform, handle: a.handle, displayName: a.displayName,
          status: a.status, brandName: a.businessBrand?.name ?? null,
          lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
        })),
      };
    } catch (error) {
      logDbError("accounts", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", accounts: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, accounts: MOCK_ACCOUNTS };
}

// ── Campaigns ────────────────────────────────────────────────
export async function getSocialCampaignsData(access?: TenantAccess): Promise<SourceMeta & { campaigns: CampaignSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, campaigns: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: clientWhere(scope),
        include: { businessBrand: { select: { name: true } }, _count: { select: { posts: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        campaigns: campaigns.map((c) => ({
          id: c.id, name: c.name, goal: c.goal, status: c.status,
          brandName: c.businessBrand?.name ?? null,
          startsAt: c.startsAt?.toISOString().slice(0, 10) ?? null,
          endsAt: c.endsAt?.toISOString().slice(0, 10) ?? null,
          postCount: c._count.posts,
        })),
      };
    } catch (error) {
      logDbError("campaigns", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", campaigns: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, campaigns: MOCK_CAMPAIGNS };
}

// ── Posts ────────────────────────────────────────────────────
export async function getSocialPostsData(access?: TenantAccess): Promise<SourceMeta & { posts: PostSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, posts: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const posts = await prisma.socialPost.findMany({
        where: clientWhere(scope),
        include: {
          campaign: { select: { name: true } },
          businessBrand: { select: { name: true } },
          approvals: { select: { status: true }, orderBy: { requestedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        posts: posts.map((p) => ({
          id: p.id, platform: p.platform, captionPreview: preview(p.caption), status: p.status,
          campaignName: p.campaign?.name ?? null, brandName: p.businessBrand?.name ?? null,
          scheduledAt: p.scheduledAt?.toISOString().slice(0, 10) ?? null,
          approvalStatus: p.approvals[0]?.status ?? null,
        })),
      };
    } catch (error) {
      logDbError("posts", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", posts: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, posts: MOCK_POSTS };
}

// ── Approvals ────────────────────────────────────────────────
export async function getSocialApprovalsData(access?: TenantAccess): Promise<SourceMeta & { approvals: ApprovalSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, approvals: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const approvals = await prisma.approval.findMany({
        where: clientWhere(scope),
        include: { socialPost: { select: { caption: true, platform: true } }, businessBrand: { select: { name: true } } },
        orderBy: { requestedAt: "desc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        approvals: approvals.map((a) => ({
          id: a.id, status: a.status, comments: a.comments,
          requestedAt: a.requestedAt.toISOString().slice(0, 10),
          postCaptionPreview: preview(a.socialPost.caption),
          postPlatform: a.socialPost.platform,
          brandName: a.businessBrand?.name ?? null,
        })),
      };
    } catch (error) {
      logDbError("approvals", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", approvals: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, approvals: MOCK_APPROVALS };
}

// ── Calendar ─────────────────────────────────────────────────
export async function getSocialCalendarData(access?: TenantAccess): Promise<SourceMeta & { items: CalendarItem[] }> {
  const base = await getSocialPostsData(access);
  return {
    source: base.source,
    sourceLabel: base.sourceLabel,
    items: base.posts.map((p) => ({
      id: p.id, date: p.scheduledAt, platform: p.platform,
      status: p.status, captionPreview: p.captionPreview, campaignName: p.campaignName,
    })),
  };
}

// ── Analytics ────────────────────────────────────────────────
export async function getSocialAnalyticsData(access?: TenantAccess): Promise<SourceMeta & { analytics: AnalyticsSummary }> {
  const empty: AnalyticsSummary = {
    hasData: false, source: null,
    totals: { reach: 0, impressions: 0, engagement: 0, clicks: 0, followers: 0 },
    days: 0,
  };
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, analytics: empty };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const analyticsWhere = { ...clientWhere(scope) };
      if (scope.clientIds?.length === 1) {
        try {
          const cutoff = await analyticsHistoryCutoffForClient(scope.clientIds[0]);
          if (cutoff) {
            Object.assign(analyticsWhere, { date: { gte: cutoff } });
          }
        } catch {
          // Billing unavailable: keep the unclipped query rather than failing the page.
        }
      }
      const agg = await prisma.socialAnalyticsDaily.aggregate({
        where: analyticsWhere,
        _sum: { reach: true, impressions: true, engagement: true, clicks: true, followers: true },
        _count: { _all: true },
      });
      const rowSource = agg._count._all > 0
        ? (await prisma.socialAnalyticsDaily.findFirst({ where: analyticsWhere, select: { source: true } }))?.source ?? null
        : null;
      return {
        source: "database", sourceLabel: DB_LABEL,
        analytics: {
          hasData: agg._count._all > 0,
          source: rowSource,
          totals: {
            reach: agg._sum.reach ?? 0,
            impressions: agg._sum.impressions ?? 0,
            engagement: agg._sum.engagement ?? 0,
            clicks: agg._sum.clicks ?? 0,
            followers: agg._sum.followers ?? 0,
          },
          days: agg._count._all,
        },
      };
    } catch (error) {
      logDbError("analytics", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", analytics: empty };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, analytics: empty };
}
