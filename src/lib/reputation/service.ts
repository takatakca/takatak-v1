import "server-only";

// Reputation (review funnel) — tenant-scoped data access.
// Every dashboard read/write takes the caller's activeClientId and scopes by it.
// Public functions resolve the tenant from the profile slug only.

import { Prisma } from "@prisma/client";

import { triggerLowRatingResponder } from "@/lib/ai-agents/service";
import { getPrisma } from "@/lib/db/prisma";

import { hashRequestToken, isWellFormedRequestToken, newPublicSlug, newRequestToken } from "./tokens";
import {
  googleReviewUrl,
  type FeedbackStatusKey,
  type PublicRatingInput,
  type ReviewChannelKey,
  type ReviewProfileInput,
} from "./validation";

const REQUEST_TTL_DAYS = 30;

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  return prisma;
}

// ------------------------------------------------------------- dashboard

export interface ReputationSnapshot {
  profiles: Array<{
    id: string;
    name: string;
    publicSlug: string;
    googlePlaceId: string | null;
    facebookReviewUrl: string | null;
    active: boolean;
    brandName: string | null;
    requestCount: number;
    responseCount: number;
  }>;
  responses: Array<{
    id: string;
    profileName: string;
    rating: number;
    feedback: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    followUpConsent: boolean;
    publicLinkClicked: boolean;
    status: FeedbackStatusKey;
    viaRequest: boolean;
    leadId: string | null;
    publishConsent: boolean;
    hiddenFromShowcase: boolean;
    aiDraft: { status: string; text: string } | null;
    createdAt: Date;
  }>;
  stats: {
    requests: number;
    opened: number;
    rated: number;
    responses: number;
    averageRating: number | null;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
    publicClicks: number;
    openFeedback: number;
  };
  brands: Array<{ id: string; name: string }>;
}

export async function getReputationSnapshot(clientId: string): Promise<ReputationSnapshot> {
  const prisma = requirePrisma();
  const [profiles, responses, requestGroups, ratingGroups, publicClicks, openFeedback, brands] = await Promise.all([
    prisma.reviewProfile.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        publicSlug: true,
        googlePlaceId: true,
        facebookReviewUrl: true,
        active: true,
        businessBrand: { select: { name: true } },
        _count: { select: { requests: true, responses: true } },
      },
    }),
    prisma.reviewResponse.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        rating: true,
        feedback: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        followUpConsent: true,
        publicLinkClickedAt: true,
        status: true,
        requestId: true,
        leadId: true,
        publishConsent: true,
        hiddenFromShowcase: true,
        createdAt: true,
        profile: { select: { name: true } },
      },
    }),
    prisma.reviewRequest.groupBy({ by: ["status"], where: { clientId }, _count: { _all: true } }),
    prisma.reviewResponse.groupBy({ by: ["rating"], where: { clientId }, _count: { _all: true } }),
    prisma.reviewResponse.count({ where: { clientId, publicLinkClickedAt: { not: null } } }),
    prisma.reviewResponse.count({ where: { clientId, status: { not: "resolved" }, rating: { lte: 3 } } }),
    prisma.businessBrand.findMany({ where: { clientId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Review Responder drafts, matched to the review they answer.
  const draftRuns = await prisma.aiAgentRun.findMany({
    where: { clientId, agentKey: "review_responder", status: { in: ["awaiting_approval", "approved", "executing", "completed"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { status: true, input: true, output: true },
  });
  const drafts = new Map<string, { status: string; text: string }>();
  for (const run of draftRuns) {
    const input = run.input && typeof run.input === "object" && !Array.isArray(run.input) ? (run.input as Record<string, unknown>) : {};
    const output = run.output && typeof run.output === "object" && !Array.isArray(run.output) ? (run.output as Record<string, unknown>) : {};
    const responseId = typeof input.reviewResponseId === "string" ? input.reviewResponseId : null;
    const text = typeof output.reply === "string" ? output.reply : typeof output.preview === "string" ? output.preview : null;
    if (responseId && text && !drafts.has(responseId)) drafts.set(responseId, { status: run.status, text: text.slice(0, 2000) });
  }

  const byStatus = Object.fromEntries(requestGroups.map((g) => [g.status, g._count._all])) as Record<string, number>;
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  let ratingCount = 0;
  for (const g of ratingGroups) {
    if (g.rating >= 1 && g.rating <= 5) distribution[g.rating as 1 | 2 | 3 | 4 | 5] = g._count._all;
    ratingSum += g.rating * g._count._all;
    ratingCount += g._count._all;
  }
  const requests = Object.values(byStatus).reduce((a, b) => a + b, 0);

  return {
    profiles: profiles.map((p) => ({
      id: p.id,
      name: p.name,
      publicSlug: p.publicSlug,
      googlePlaceId: p.googlePlaceId,
      facebookReviewUrl: p.facebookReviewUrl,
      active: p.active,
      brandName: p.businessBrand?.name ?? null,
      requestCount: p._count.requests,
      responseCount: p._count.responses,
    })),
    responses: responses.map((r) => ({
      id: r.id,
      profileName: r.profile.name,
      rating: r.rating,
      feedback: r.feedback,
      contactName: r.contactName,
      contactEmail: r.contactEmail,
      contactPhone: r.contactPhone,
      followUpConsent: r.followUpConsent,
      publicLinkClicked: r.publicLinkClickedAt !== null,
      status: r.status,
      viaRequest: r.requestId !== null,
      leadId: r.leadId,
      publishConsent: r.publishConsent,
      hiddenFromShowcase: r.hiddenFromShowcase,
      aiDraft: drafts.get(r.id) ?? null,
      createdAt: r.createdAt,
    })),
    stats: {
      requests,
      opened: (byStatus.opened ?? 0) + (byStatus.rated ?? 0),
      rated: byStatus.rated ?? 0,
      responses: ratingCount,
      averageRating: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
      distribution,
      publicClicks,
      openFeedback,
    },
    brands,
  };
}

export async function createReviewProfile(clientId: string, input: ReviewProfileInput): Promise<{ id: string; publicSlug: string }> {
  const prisma = requirePrisma();
  if (input.businessBrandId) {
    const brand = await prisma.businessBrand.findFirst({ where: { id: input.businessBrandId, clientId }, select: { id: true } });
    if (!brand) throw new Error("brand_not_in_workspace");
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.reviewProfile.create({
        data: {
          clientId,
          businessBrandId: input.businessBrandId,
          name: input.name,
          publicSlug: newPublicSlug(input.name),
          googlePlaceId: input.googlePlaceId,
          facebookReviewUrl: input.facebookReviewUrl,
          thankYouMessage: input.thankYouMessage,
        },
        select: { id: true, publicSlug: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("slug_collision");
}

export async function setReviewProfileActive(clientId: string, profileId: string, active: boolean): Promise<boolean> {
  const prisma = requirePrisma();
  const result = await prisma.reviewProfile.updateMany({ where: { id: profileId, clientId }, data: { active } });
  return result.count === 1;
}

export async function createReviewRequest(
  clientId: string,
  profileId: string,
  input: { channel: ReviewChannelKey; recipientName: string | null },
  actorProfileId: string | null,
): Promise<{ token: string; publicSlug: string; requestId: string; profileName: string } | null> {
  const prisma = requirePrisma();
  const profile = await prisma.reviewProfile.findFirst({
    where: { id: profileId, clientId, active: true },
    select: { id: true, publicSlug: true, name: true },
  });
  if (!profile) return null;
  const { token, tokenHash } = newRequestToken();
  const request = await prisma.reviewRequest.create({
    data: {
      clientId,
      profileId: profile.id,
      channel: input.channel,
      recipientName: input.recipientName,
      tokenHash,
      expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * 86_400_000),
      createdByProfileId: actorProfileId,
    },
    select: { id: true },
  });
  return { token, publicSlug: profile.publicSlug, requestId: request.id, profileName: profile.name };
}

/** Records the outcome of an automatic send. Only a masked recipient is kept. */
export async function recordRequestDelivery(
  clientId: string,
  requestId: string,
  delivery: { status: "sent" | "failed"; providerMessageId: string | null; recipientMasked: string },
): Promise<void> {
  await requirePrisma().reviewRequest.updateMany({
    where: { id: requestId, clientId },
    data: {
      sentAt: delivery.status === "sent" ? new Date() : null,
      deliveryStatus: delivery.status,
      providerMessageId: delivery.providerMessageId,
      recipientMasked: delivery.recipientMasked,
    },
  });
}

export async function updateFeedbackStatus(
  clientId: string,
  responseId: string,
  status: FeedbackStatusKey,
  actorProfileId: string | null,
): Promise<boolean> {
  const prisma = requirePrisma();
  const result = await prisma.reviewResponse.updateMany({
    where: { id: responseId, clientId },
    data: {
      status,
      resolvedAt: status === "resolved" ? new Date() : null,
      resolvedByProfileId: status === "resolved" ? actorProfileId : null,
    },
  });
  return result.count === 1;
}

// ---------------------------------------------------------------- public

export interface PublicReviewPage {
  profileName: string;
  publicSlug: string;
  hasGoogle: boolean;
  hasFacebook: boolean;
  thankYouMessage: string | null;
  /** Present only when the token is valid, unexpired and not yet used. */
  requestToken: string | null;
  recipientName: string | null;
  alreadyRated: boolean;
}

async function findUsableRequest(profileId: string, token: string | null) {
  if (!token || !isWellFormedRequestToken(token)) return null;
  const prisma = requirePrisma();
  const request = await prisma.reviewRequest.findUnique({
    where: { tokenHash: hashRequestToken(token) },
    select: { id: true, profileId: true, clientId: true, status: true, expiresAt: true, recipientName: true },
  });
  if (!request || request.profileId !== profileId || request.expiresAt.getTime() < Date.now()) return null;
  return request;
}

export async function getPublicReviewPage(slug: string, token: string | null): Promise<PublicReviewPage | null> {
  const prisma = requirePrisma();
  const profile = await prisma.reviewProfile.findUnique({
    where: { publicSlug: slug },
    select: { id: true, name: true, publicSlug: true, active: true, googlePlaceId: true, facebookReviewUrl: true, thankYouMessage: true },
  });
  if (!profile || !profile.active) return null;

  const request = await findUsableRequest(profile.id, token);
  if (request && request.status === "created") {
    await prisma.reviewRequest.updateMany({
      where: { id: request.id, status: "created" },
      data: { status: "opened", openedAt: new Date() },
    });
  }

  return {
    profileName: profile.name,
    publicSlug: profile.publicSlug,
    hasGoogle: Boolean(profile.googlePlaceId),
    hasFacebook: Boolean(profile.facebookReviewUrl),
    thankYouMessage: profile.thankYouMessage,
    requestToken: request && request.status !== "rated" ? token : null,
    recipientName: request?.recipientName ?? null,
    alreadyRated: request?.status === "rated",
  };
}

export type SubmitRatingResult =
  | { ok: true; responseId: string; hasGoogle: boolean; hasFacebook: boolean; thankYouMessage: string | null }
  | { ok: false; error: string };

export async function submitPublicRating(slug: string, token: string | null, input: PublicRatingInput): Promise<SubmitRatingResult> {
  const prisma = requirePrisma();
  const profile = await prisma.reviewProfile.findUnique({
    where: { publicSlug: slug },
    select: { id: true, clientId: true, name: true, active: true, googlePlaceId: true, facebookReviewUrl: true, thankYouMessage: true },
  });
  if (!profile || !profile.active) return { ok: false, error: "This review page is no longer available." };

  const request = await findUsableRequest(profile.id, token);
  if (request && request.status === "rated") return { ok: false, error: "Thanks — this invitation was already used." };

  try {
    const response = await prisma.$transaction(async (tx) => {
      if (request) {
        const claimed = await tx.reviewRequest.updateMany({
          where: { id: request.id, status: { not: "rated" } },
          data: { status: "rated", ratedAt: new Date() },
        });
        if (claimed.count !== 1) throw new Error("request_already_rated");
      }
      return tx.reviewResponse.create({
        data: {
          clientId: profile.clientId,
          profileId: profile.id,
          requestId: request?.id ?? null,
          rating: input.rating,
          feedback: input.feedback,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          followUpConsent: input.followUpConsent,
          publishConsent: input.publishConsent,
        },
        select: { id: true },
      });
    });
    try {
      await triggerLowRatingResponder(profile.clientId, {
        responseId: response.id,
        rating: input.rating,
        feedback: input.feedback,
        businessName: profile.name,
      });
    } catch {
      // The rating is already saved; an agent trigger failure must never fail the customer.
      console.error("[reputation] low-rating agent trigger failed");
    }
    return {
      ok: true,
      responseId: response.id,
      hasGoogle: Boolean(profile.googlePlaceId),
      hasFacebook: Boolean(profile.facebookReviewUrl),
      thankYouMessage: profile.thankYouMessage,
    };
  } catch (error) {
    if (
      (error instanceof Error && error.message === "request_already_rated") ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    ) {
      return { ok: false, error: "Thanks — this invitation was already used." };
    }
    throw error;
  }
}

/**
 * Records that the customer went on to the public review site and returns the
 * destination, built server-side from the stored profile (never from input).
 */
export async function resolvePublicReviewDestination(
  slug: string,
  responseId: string | null,
  target: "google" | "facebook",
): Promise<string | null> {
  const prisma = requirePrisma();
  const profile = await prisma.reviewProfile.findUnique({
    where: { publicSlug: slug },
    select: { id: true, active: true, googlePlaceId: true, facebookReviewUrl: true },
  });
  if (!profile || !profile.active) return null;
  const destination =
    target === "google"
      ? profile.googlePlaceId
        ? googleReviewUrl(profile.googlePlaceId)
        : null
      : profile.facebookReviewUrl;
  if (!destination) return null;
  if (responseId && /^[0-9a-f-]{36}$/i.test(responseId)) {
    await prisma.reviewResponse.updateMany({
      where: { id: responseId, profileId: profile.id, publicLinkClickedAt: null },
      data: { publicLinkClickedAt: new Date() },
    });
  }
  return destination;
}

/** Turns a customer's follow-up request into a Lead in the Leads module, once. */
export async function convertReviewResponseToLead(clientId: string, responseId: string): Promise<{ leadId: string } | null> {
  const prisma = requirePrisma();
  try {
    return await prisma.$transaction(async (tx) => {
      const response = await tx.reviewResponse.findFirst({
        where: { id: responseId, clientId },
        select: {
          id: true,
          leadId: true,
          rating: true,
          feedback: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          followUpConsent: true,
          profile: { select: { name: true, businessBrandId: true } },
        },
      });
      if (!response || !response.followUpConsent) return null;
      if (response.leadId) return { leadId: response.leadId };
      const lead = await tx.lead.create({
        data: {
          clientId,
          businessBrandId: response.profile.businessBrandId,
          name: response.contactName,
          email: response.contactEmail,
          phone: response.contactPhone,
          message: `${response.rating}★ review follow-up: ${response.feedback ?? "(no comment)"}`.slice(0, 4000),
          priority: response.rating <= 2 ? "high" : "normal",
          metadata: { source: "takatak_review_funnel", reviewResponseId: response.id, profile: response.profile.name },
        },
        select: { id: true },
      });
      const claimed = await tx.reviewResponse.updateMany({ where: { id: response.id, leadId: null }, data: { leadId: lead.id } });
      if (claimed.count !== 1) throw new Error("lead_already_linked");
      return { leadId: lead.id };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "lead_already_linked") {
      const existing = await prisma.reviewResponse.findFirst({ where: { id: responseId, clientId }, select: { leadId: true } });
      return existing?.leadId ? { leadId: existing.leadId } : null;
    }
    throw error;
  }
}

// --------------------------------------------------------------- showcase

export interface ShowcaseData {
  businessName: string;
  averageRating: number | null;
  ratingCount: number;
  reviews: Array<{ firstName: string | null; rating: number; text: string; date: string }>;
}

function firstNameOnly(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 30) : null;
}

/**
 * Public review showcase. The average covers EVERY rating (not just the
 * featured ones); only 4–5★ comments with explicit publish consent, and not
 * hidden by the owner, are listed — first name only.
 */
export async function getReviewShowcase(slug: string, limit = 6): Promise<ShowcaseData | null> {
  const prisma = requirePrisma();
  const profile = await prisma.reviewProfile.findUnique({ where: { publicSlug: slug }, select: { id: true, name: true, active: true } });
  if (!profile || !profile.active) return null;
  const [aggregate, featured] = await Promise.all([
    prisma.reviewResponse.aggregate({ where: { profileId: profile.id }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.reviewResponse.findMany({
      where: { profileId: profile.id, publishConsent: true, hiddenFromShowcase: false, rating: { gte: 4 }, feedback: { not: null } },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 12),
      select: { rating: true, feedback: true, contactName: true, createdAt: true },
    }),
  ]);
  return {
    businessName: profile.name,
    averageRating: aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
    ratingCount: aggregate._count._all,
    reviews: featured.map((r) => ({
      firstName: firstNameOnly(r.contactName),
      rating: r.rating,
      text: (r.feedback ?? "").slice(0, 600),
      date: r.createdAt.toISOString().slice(0, 10),
    })),
  };
}

export async function setShowcaseHidden(clientId: string, responseId: string, hidden: boolean): Promise<boolean> {
  const result = await requirePrisma().reviewResponse.updateMany({ where: { id: responseId, clientId }, data: { hiddenFromShowcase: hidden } });
  return result.count === 1;
}
