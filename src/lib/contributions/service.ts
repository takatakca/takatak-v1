import "server-only";

import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { getHockeyMembershipSnapshot } from "@/lib/billing/hockey/membership-service";
import { AHMV_PUBLISHER } from "./publishers";
import {
  CONTRIBUTOR_REWARDS,
  contributorBadge,
  contributionPatchPolicy,
  contributionPoints,
  contributionPriority,
  contributionReviewDueAt,
  contributionSlaLabel,
  editableFieldsForResource,
  publicationMayBeQueued,
} from "./policy";
import { screenContribution } from "./screening";
import type {
  ContentRegistryInput,
  ContributionDecision,
  ContributionInput,
  ContributorTier,
} from "./types";
import { sendModeratorEmail } from "./moderator-email";

function asInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function ahmvScope() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DATABASE_UNAVAILABLE");

  const brand = await prisma.businessBrand.findFirst({
    where: {
      website: { in: [AHMV_PUBLISHER.brandWebsite, "https://www.ahmverdun.ca"] },
      status: "active",
    },
    select: { id: true, clientId: true, name: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!brand) throw new Error("AHMV_BRAND_NOT_CONFIGURED");
  return { prisma, brand };
}

function safeHttpsUrls(values: readonly string[] | undefined, max = 8): string[] {
  return (values ?? [])
    .slice(0, max)
    .map((value) => value.trim())
    .filter((value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    });
}

async function resolveContributor(authUserId?: string): Promise<{
  profileId?: string;
  authUserId?: string;
  tier: ContributorTier;
}> {
  if (!authUserId) return { tier: "guest" };

  const prisma = getPrisma();
  if (!prisma) return { tier: "guest" };

  const profile = await prisma.profile.findUnique({
    where: { authUserId },
    select: { id: true, status: true },
  });

  const membership = await getHockeyMembershipSnapshot(authUserId);
  const tier: ContributorTier =
    membership.access === "paid"
      ? "member"
      : profile?.status === "active"
        ? "registered"
        : "guest";

  return {
    tier,
    ...(profile?.id ? { profileId: profile.id } : {}),
    ...(authUserId ? { authUserId } : {}),
  };
}

async function updateReputationOnSubmission(options: {
  clientId: string;
  profileId?: string;
  publisherCode: string;
  now: Date;
}) {
  if (!options.profileId) return;
  const prisma = getPrisma();
  if (!prisma) return;

  await prisma.contributorReputation.upsert({
    where: {
      clientId_profileId_publisherCode: {
        clientId: options.clientId,
        profileId: options.profileId,
        publisherCode: options.publisherCode,
      },
    },
    create: {
      clientId: options.clientId,
      profileId: options.profileId,
      publisherCode: options.publisherCode,
      submittedCount: 1,
      lastContributionAt: options.now,
    },
    update: {
      submittedCount: { increment: 1 },
      lastContributionAt: options.now,
    },
  });
}

async function awardApprovedContribution(options: {
  clientId: string;
  profileId?: string;
  publisherCode: string;
  contributionId: string;
  resourceType: Parameters<typeof contributionPoints>[0];
  published: boolean;
}) {
  if (!options.profileId) return;
  const prisma = getPrisma();
  if (!prisma) return;

  const reputation = await prisma.contributorReputation.findUnique({
    where: {
      clientId_profileId_publisherCode: {
        clientId: options.clientId,
        profileId: options.profileId,
        publisherCode: options.publisherCode,
      },
    },
  });
  if (!reputation) return;

  const points = contributionPoints(options.resourceType);
  const exists = await prisma.contributionPointLedger.findFirst({
    where: {
      reputationId: reputation.id,
      contributionId: options.contributionId,
      reason: "approved_contribution",
    },
    select: { id: true },
  });
  if (exists) return;

  const nextPoints = reputation.points + points;
  const nextApproved = reputation.approvedCount + 1;
  const nextPublished = reputation.publishedCount + (options.published ? 1 : 0);
  const badge = contributorBadge({
    points: nextPoints,
    approvedCount: nextApproved,
    publishedCount: nextPublished,
  });

  await prisma.$transaction(async (tx) => {
    await tx.contributionPointLedger.create({
      data: {
        reputationId: reputation.id,
        contributionId: options.contributionId,
        points,
        reason: "approved_contribution",
      },
    });
    await tx.contributorReputation.update({
      where: { id: reputation.id },
      data: {
        points: nextPoints,
        approvedCount: nextApproved,
        publishedCount: nextPublished,
        currentBadge: badge,
      },
    });

    for (const reward of CONTRIBUTOR_REWARDS) {
      if (nextPoints < reward.thresholdPoints) continue;
      await tx.contributionRewardLedger.upsert({
        where: {
          reputationId_code_thresholdPoints: {
            reputationId: reputation.id,
            code: reward.code,
            thresholdPoints: reward.thresholdPoints,
          },
        },
        create: {
          reputationId: reputation.id,
          code: reward.code,
          thresholdPoints: reward.thresholdPoints,
          units: reward.weeks,
          status: "available",
        },
        update: {},
      });
    }
  });
}

export async function syncAhmvManagedContent(items: readonly ContentRegistryInput[]) {
  const { prisma, brand } = await ahmvScope();
  const results: Array<{ resourceType: string; resourceKey: string; status: string }> = [];

  for (const item of items.slice(0, 100)) {
    const existing = await prisma.managedContentItem.findUnique({
      where: {
        publisherCode_resourceType_resourceKey: {
          publisherCode: AHMV_PUBLISHER.code,
          resourceType: item.resourceType,
          resourceKey: item.resourceKey,
        },
      },
      select: { id: true, version: true },
    });

    const version = Math.max(1, item.version ?? 1);
    if (existing && version < existing.version) {
      results.push({ resourceType: item.resourceType, resourceKey: item.resourceKey, status: "stale_ignored" });
      continue;
    }

    await prisma.managedContentItem.upsert({
      where: {
        publisherCode_resourceType_resourceKey: {
          publisherCode: AHMV_PUBLISHER.code,
          resourceType: item.resourceType,
          resourceKey: item.resourceKey,
        },
      },
      create: {
        clientId: brand.clientId,
        businessBrandId: brand.id,
        publisherCode: AHMV_PUBLISHER.code,
        resourceType: item.resourceType,
        resourceKey: item.resourceKey,
        title: item.title?.slice(0, 300),
        canonicalUrl: item.canonicalUrl,
        sourceKind: item.sourceKind.slice(0, 80),
        sourceUrl: item.sourceUrl,
        snapshot: asInputJson(item.snapshot),
        editableFields: (
          item.editableFields?.length
            ? item.editableFields
            : editableFieldsForResource(item.resourceType)
        ).slice(0, 50),
        version,
      },
      update: {
        title: item.title?.slice(0, 300),
        canonicalUrl: item.canonicalUrl,
        sourceKind: item.sourceKind.slice(0, 80),
        sourceUrl: item.sourceUrl,
        snapshot: asInputJson(item.snapshot),
        editableFields: (
          item.editableFields?.length
            ? item.editableFields
            : editableFieldsForResource(item.resourceType)
        ).slice(0, 50),
        version,
        lastSyncedAt: new Date(),
      },
    });

    results.push({ resourceType: item.resourceType, resourceKey: item.resourceKey, status: existing ? "updated" : "created" });
  }

  return { synced: results.length, results };
}

export async function submitAhmvContribution(input: ContributionInput) {
  const { prisma, brand } = await ahmvScope();
  const now = new Date();
  const contributor = await resolveContributor(input.contributorAuthUserId);
  const priority = contributionPriority(contributor.tier);
  const dueAt = contributionReviewDueAt(now, contributor.tier);
  let screening = screenContribution(input);

  const managed = await prisma.managedContentItem.findUnique({
    where: {
      publisherCode_resourceType_resourceKey: {
        publisherCode: AHMV_PUBLISHER.code,
        resourceType: input.resourceType,
        resourceKey: input.resourceKey,
      },
    },
    select: { id: true, version: true, snapshot: true, editableFields: true },
  });

  const patchPolicy = contributionPatchPolicy({
    resourceType: input.resourceType,
    patch: input.proposedPatch,
    ...(managed?.editableFields?.length
      ? { registryEditableFields: managed.editableFields }
      : {}),
  });
  if (!patchPolicy.valid) {
    screening = {
      ...screening,
      status: "flagged",
      flags: Array.from(new Set([
        ...screening.flags,
        ...patchPolicy.protectedFields.map((field) => `protected_field:${field}`),
        ...patchPolicy.disallowedFields.map((field) => `disallowed_field:${field}`),
      ])),
    };
  }

  const existing = await prisma.contentContribution.findUnique({
    where: {
      publisherCode_idempotencyKey: {
        publisherCode: AHMV_PUBLISHER.code,
        idempotencyKey: input.idempotencyKey,
      },
    },
    select: {
      id: true,
      status: true,
      priority: true,
      reviewDueAt: true,
    },
  });
  if (existing) {
    return {
      id: existing.id,
      duplicate: true,
      status: existing.status,
      priority: existing.priority,
      reviewDueAt: existing.reviewDueAt.toISOString(),
      sla: existing.priority === "member_priority" ? "48 hours" : "1–7 days",
    };
  }

  const created = await prisma.contentContribution.create({
    data: {
      clientId: brand.clientId,
      businessBrandId: brand.id,
      managedContentItemId: managed?.id,
      publisherCode: AHMV_PUBLISHER.code,
      idempotencyKey: input.idempotencyKey.slice(0, 120),
      resourceType: input.resourceType,
      resourceKey: input.resourceKey.slice(0, 180),
      action: input.action,
      targetUrl: input.targetUrl,
      originalVersion: input.originalVersion ?? managed?.version,
      ...((input.originalSnapshot ?? managed?.snapshot) != null
        ? { originalSnapshot: asInputJson(input.originalSnapshot ?? managed?.snapshot) }
        : {}),
      proposedPatch: asInputJson(input.proposedPatch),
      reason: input.reason?.slice(0, 2000),
      evidenceUrls: safeHttpsUrls(input.evidenceUrls),
      attachmentUrls: safeHttpsUrls(input.attachmentUrls),
      contributorProfileId: contributor.profileId,
      contributorAuthUserId: contributor.authUserId,
      contributorTier: contributor.tier,
      priority,
      reviewDueAt: dueAt,
      aiReviewStatus: screening.status,
      aiReview: screening,
      events: {
        create: [
          {
            actorProfileId: contributor.profileId,
            eventType: "submitted",
            metadata: {
              tier: contributor.tier,
              priority,
              sla: contributionSlaLabel(contributor.tier),
            },
          },
          {
            actorProfileId: contributor.profileId,
            eventType: "machine_screened",
            metadata: screening,
          },
        ],
      },
    },
    select: {
      id: true,
      status: true,
      priority: true,
      reviewDueAt: true,
      aiReviewStatus: true,
    },
  });

  await updateReputationOnSubmission({
    clientId: brand.clientId,
    profileId: contributor.profileId,
    publisherCode: AHMV_PUBLISHER.code,
    now,
  });

  await prisma.notification.create({
    data: {
      clientId: brand.clientId,
      type: "approval_needed",
      title: priority === "member_priority"
        ? "Priority AHMV contribution needs review"
        : "AHMV contribution needs review",
      message: `${input.resourceType} · ${input.resourceKey} · ${contributionSlaLabel(contributor.tier)} SLA`,
      relatedEntityType: "content_contribution",
      relatedEntityId: created.id,
    },
  });

  const emailStatus = await sendModeratorEmail({
    to: AHMV_PUBLISHER.moderatorEmail,
    subject:
      priority === "member_priority"
        ? `[HIGH PRIORITY · 48H] AHMV contribution · ${input.resourceType}`
        : `[LOW PRIORITY · 1-7 DAYS] AHMV contribution · ${input.resourceType}`,
    text: [
      "A new AHMV community contribution is waiting for human moderation.",
      "",
      `Resource: ${input.resourceType} · ${input.resourceKey}`,
      `Action: ${input.action}`,
      `Contributor tier: ${contributor.tier}`,
      `Priority: ${priority}`,
      `Review due: ${dueAt.toISOString()}`,
      `Machine screening: ${screening.status}`,
      screening.flags.length ? `Flags: ${screening.flags.join(", ")}` : "Flags: none",
      "",
      `Moderation: https://takatak.ca${AHMV_PUBLISHER.dashboardPath}`,
      `Contribution ID: ${created.id}`,
    ].join("\n"),
  });

  await prisma.contentContributionEvent.create({
    data: {
      contributionId: created.id,
      eventType: "moderator_notification_attempted",
      metadata: { emailStatus },
    },
  });

  return {
    id: created.id,
    duplicate: false,
    status: created.status,
    priority: created.priority,
    reviewDueAt: created.reviewDueAt.toISOString(),
    sla: contributionSlaLabel(contributor.tier),
    machineScreening: created.aiReviewStatus,
    emailStatus,
  };
}

export async function listModerationQueue(options: {
  clientId: string;
  publisherCode?: string;
  status?: string;
  limit?: number;
}) {
  const prisma = getPrisma();
  if (!prisma) return [];

  return prisma.contentContribution.findMany({
    where: {
      clientId: options.clientId,
      ...(options.publisherCode ? { publisherCode: options.publisherCode } : {}),
      ...(options.status ? { status: options.status } : { status: "pending_review" }),
    },
    orderBy: [
      { priority: "desc" },
      { reviewDueAt: "asc" },
      { createdAt: "asc" },
    ],
    take: Math.max(1, Math.min(options.limit ?? 100, 200)),
    select: {
      id: true,
      publisherCode: true,
      resourceType: true,
      resourceKey: true,
      action: true,
      reason: true,
      proposedPatch: true,
      evidenceUrls: true,
      attachmentUrls: true,
      contributorTier: true,
      priority: true,
      reviewDueAt: true,
      status: true,
      aiReviewStatus: true,
      aiReview: true,
      createdAt: true,
      contributor: {
        select: { displayName: true, firstName: true, lastName: true },
      },
    },
  });
}

export async function reviewContribution(options: {
  clientId: string;
  contributionId: string;
  moderatorProfileId: string;
  decision: ContributionDecision;
  comment?: string;
  officialSourceVerified?: boolean;
}) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DATABASE_UNAVAILABLE");

  const contribution = await prisma.contentContribution.findFirst({
    where: { id: options.contributionId, clientId: options.clientId },
    include: { managedContentItem: { select: { id: true, version: true } } },
  });
  if (!contribution) throw new Error("CONTRIBUTION_NOT_FOUND");
  if (!["pending_review", "changes_requested"].includes(contribution.status)) {
    throw new Error("CONTRIBUTION_NOT_REVIEWABLE");
  }

  const now = new Date();
  if (options.decision === "reject") {
    await prisma.$transaction([
      prisma.contentContribution.update({
        where: { id: contribution.id },
        data: {
          status: "rejected",
          moderatorProfileId: options.moderatorProfileId,
          moderatorComment: options.comment?.slice(0, 3000),
          reviewedAt: now,
        },
      }),
      prisma.contentContributionEvent.create({
        data: {
          contributionId: contribution.id,
          actorProfileId: options.moderatorProfileId,
          eventType: "rejected",
          metadata: { comment: options.comment?.slice(0, 1000) ?? null },
        },
      }),
      ...(contribution.contributorProfileId
        ? [
            prisma.contributorReputation.update({
              where: {
                clientId_profileId_publisherCode: {
                  clientId: contribution.clientId,
                  profileId: contribution.contributorProfileId,
                  publisherCode: contribution.publisherCode,
                },
              },
              data: { rejectedCount: { increment: 1 } },
            }),
          ]
        : []),
    ]);
    return { status: "rejected", publicationQueued: false };
  }

  if (options.decision === "changes_requested") {
    await prisma.$transaction([
      prisma.contentContribution.update({
        where: { id: contribution.id },
        data: {
          status: "changes_requested",
          moderatorProfileId: options.moderatorProfileId,
          moderatorComment: options.comment?.slice(0, 3000),
          reviewedAt: now,
        },
      }),
      prisma.contentContributionEvent.create({
        data: {
          contributionId: contribution.id,
          actorProfileId: options.moderatorProfileId,
          eventType: "changes_requested",
          metadata: { comment: options.comment?.slice(0, 1000) ?? null },
        },
      }),
    ]);
    return { status: "changes_requested", publicationQueued: false };
  }

  const mayPublish = publicationMayBeQueued({
    resourceType: contribution.resourceType as Parameters<typeof publicationMayBeQueued>[0]["resourceType"],
    moderatorConfirmedOfficialSource: options.officialSourceVerified === true,
  });
  if (!mayPublish) {
    throw new Error("OFFICIAL_SOURCE_VERIFICATION_REQUIRED");
  }

  const nextVersion = Math.max(1, (contribution.managedContentItem?.version ?? 0) + 1);
  await prisma.$transaction(async (tx) => {
    await tx.contentPublication.updateMany({
      where: {
        publisherCode: contribution.publisherCode,
        resourceType: contribution.resourceType,
        resourceKey: contribution.resourceKey,
        active: true,
      },
      data: { active: false, status: "revoked" },
    });

    await tx.contentPublication.create({
      data: {
        clientId: contribution.clientId,
        businessBrandId: contribution.businessBrandId,
        contributionId: contribution.id,
        managedContentItemId: contribution.managedContentItemId,
        publisherCode: contribution.publisherCode,
        resourceType: contribution.resourceType,
        resourceKey: contribution.resourceKey,
        patch: asInputJson(contribution.proposedPatch),
        version: nextVersion,
        status: "ready",
        active: true,
      },
    });

    await tx.contentContribution.update({
      where: { id: contribution.id },
      data: {
        status: "approved",
        moderatorProfileId: options.moderatorProfileId,
        moderatorComment: options.comment?.slice(0, 3000),
        reviewedAt: now,
        approvedAt: now,
      },
    });

    await tx.contentContributionEvent.create({
      data: {
        contributionId: contribution.id,
        actorProfileId: options.moderatorProfileId,
        eventType: "approved",
        metadata: {
          publicationQueued: true,
          officialSourceVerified: options.officialSourceVerified === true,
          version: nextVersion,
        },
      },
    });
  });

  await awardApprovedContribution({
    clientId: contribution.clientId,
    profileId: contribution.contributorProfileId ?? undefined,
    publisherCode: contribution.publisherCode,
    contributionId: contribution.id,
    resourceType: contribution.resourceType as Parameters<typeof contributionPoints>[0],
    published: false,
  });

  return { status: "approved", publicationQueued: true, version: nextVersion };
}

export async function listAhmvActivePublications() {
  const { prisma, brand } = await ahmvScope();
  const rows = await prisma.contentPublication.findMany({
    where: {
      clientId: brand.clientId,
      publisherCode: AHMV_PUBLISHER.code,
      active: true,
      status: { in: ["ready", "applied"] },
    },
    orderBy: [{ resourceType: "asc" }, { resourceKey: "asc" }, { version: "desc" }],
    select: {
      id: true,
      contributionId: true,
      resourceType: true,
      resourceKey: true,
      patch: true,
      version: true,
      status: true,
      createdAt: true,
    },
  });

  return rows;
}

export async function acknowledgeAhmvPublication(options: {
  publicationId: string;
  applied: boolean;
  snapshot?: Record<string, unknown>;
}) {
  const { prisma, brand } = await ahmvScope();
  const publication = await prisma.contentPublication.findFirst({
    where: {
      id: options.publicationId,
      clientId: brand.clientId,
      publisherCode: AHMV_PUBLISHER.code,
      active: true,
    },
  });
  if (!publication) throw new Error("PUBLICATION_NOT_FOUND");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.contentPublication.update({
      where: { id: publication.id },
      data: {
        status: options.applied ? "applied" : "failed",
        acknowledgedAt: now,
        errorMessage: options.applied ? null : "Publisher reported apply failure.",
      },
    });

    if (options.applied) {
      await tx.contentContribution.update({
        where: { id: publication.contributionId },
        data: { status: "published", publishedAt: now },
      });
      await tx.contentContributionEvent.create({
        data: {
          contributionId: publication.contributionId,
          eventType: "publisher_applied",
          metadata: { publicationId: publication.id, version: publication.version },
        },
      });
      if (publication.managedContentItemId && options.snapshot) {
        await tx.managedContentItem.update({
          where: { id: publication.managedContentItemId },
          data: {
            snapshot: asInputJson(options.snapshot),
            version: publication.version,
            lastSyncedAt: now,
          },
        });
      }
    } else {
      await tx.contentContributionEvent.create({
        data: {
          contributionId: publication.contributionId,
          eventType: "publisher_apply_failed",
          metadata: { publicationId: publication.id },
        },
      });
    }
  });

  if (options.applied) {
    const contribution = await prisma.contentContribution.findUnique({
      where: { id: publication.contributionId },
      select: {
        contributorProfileId: true,
        clientId: true,
        publisherCode: true,
      },
    });
    if (contribution?.contributorProfileId) {
      const reputation = await prisma.contributorReputation.findUnique({
        where: {
          clientId_profileId_publisherCode: {
            clientId: contribution.clientId,
            profileId: contribution.contributorProfileId,
            publisherCode: contribution.publisherCode,
          },
        },
      });
      if (reputation) {
        const publishedCount = reputation.publishedCount + 1;
        await prisma.contributorReputation.update({
          where: { id: reputation.id },
          data: {
            publishedCount,
            currentBadge: contributorBadge({
              points: reputation.points,
              approvedCount: reputation.approvedCount,
              publishedCount,
            }),
          },
        });
      }
    }
  }

  return { status: options.applied ? "applied" : "failed" };
}


export async function getAhmvContributorSnapshot(authUserId: string) {
  const { prisma, brand } = await ahmvScope();
  const profile = await prisma.profile.findUnique({
    where: { authUserId },
    select: { id: true, displayName: true, firstName: true, lastName: true },
  });

  if (!profile) {
    return {
      registered: false,
      membership: "guest",
      reputation: null,
      recentContributions: [],
    };
  }

  const membership = await getHockeyMembershipSnapshot(authUserId);
  const reputation = await prisma.contributorReputation.findUnique({
    where: {
      clientId_profileId_publisherCode: {
        clientId: brand.clientId,
        profileId: profile.id,
        publisherCode: AHMV_PUBLISHER.code,
      },
    },
    select: {
      points: true,
      submittedCount: true,
      approvedCount: true,
      publishedCount: true,
      rejectedCount: true,
      currentBadge: true,
      lastContributionAt: true,
      rewardLedger: {
        where: { status: "available", code: "membership_week_credit" },
        orderBy: { thresholdPoints: "asc" },
        select: {
          id: true,
          code: true,
          thresholdPoints: true,
          units: true,
          status: true,
          issuedAt: true,
        },
      },
    },
  });

  const recentContributions = await prisma.contentContribution.findMany({
    where: {
      clientId: brand.clientId,
      publisherCode: AHMV_PUBLISHER.code,
      contributorProfileId: profile.id,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      resourceType: true,
      resourceKey: true,
      action: true,
      priority: true,
      status: true,
      reviewDueAt: true,
      createdAt: true,
      reviewedAt: true,
      publishedAt: true,
    },
  });

  return {
    registered: true,
    membership: membership.access === "paid" ? "member" : "registered",
    profile: {
      displayName:
        profile.displayName ||
        [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
        "AHMV contributor",
    },
    reputation: reputation ?? {
      points: 0,
      submittedCount: 0,
      approvedCount: 0,
      publishedCount: 0,
      rejectedCount: 0,
      currentBadge: "new_contributor",
      lastContributionAt: null,
      rewardLedger: [],
    },
    availableMembershipWeeks:
      reputation?.rewardLedger.reduce((total, reward) => total + reward.units, 0) ?? 0,
    recentContributions,
  };
}

export async function getAhmvContributionStatus(contributionId: string) {
  const { prisma, brand } = await ahmvScope();
  return prisma.contentContribution.findFirst({
    where: {
      id: contributionId,
      clientId: brand.clientId,
      publisherCode: AHMV_PUBLISHER.code,
    },
    select: {
      id: true,
      resourceType: true,
      resourceKey: true,
      action: true,
      priority: true,
      reviewDueAt: true,
      status: true,
      aiReviewStatus: true,
      moderatorComment: true,
      reviewedAt: true,
      approvedAt: true,
      publishedAt: true,
      createdAt: true,
    },
  });
}
