import type {
  ContentResourceType,
  ContributorTier,
  ContributionPriority,
} from "./types";

export const STANDARD_REVIEW_MAX_HOURS = 7 * 24;
export const MEMBER_REVIEW_MAX_HOURS = 48;

export function contributionPriority(
  tier: ContributorTier,
): ContributionPriority {
  return tier === "member" ? "member_priority" : "standard";
}

export function contributionReviewDueAt(
  now: Date,
  tier: ContributorTier,
): Date {
  const hours =
    tier === "member" ? MEMBER_REVIEW_MAX_HOURS : STANDARD_REVIEW_MAX_HOURS;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export function contributionSlaLabel(
  tier: ContributorTier,
): string {
  return tier === "member" ? "48 hours" : "1–7 days";
}

const OFFICIAL_AUTHORITY_TYPES = new Set<ContentResourceType>(["schedule"]);

export function requiresOfficialSourceVerification(
  resourceType: ContentResourceType,
): boolean {
  return OFFICIAL_AUTHORITY_TYPES.has(resourceType);
}

export function publicationMayBeQueued(options: {
  resourceType: ContentResourceType;
  moderatorConfirmedOfficialSource: boolean;
}): boolean {
  if (!requiresOfficialSourceVerification(options.resourceType)) return true;
  return options.moderatorConfirmedOfficialSource;
}

export type ContributorBadge =
  | "new_contributor"
  | "community_helper"
  | "trusted_contributor"
  | "community_expert"
  | "community_champion";

export function contributorBadge(input: {
  points: number;
  approvedCount: number;
  publishedCount: number;
}): ContributorBadge {
  if (input.points >= 1500 && input.publishedCount >= 75) return "community_champion";
  if (input.points >= 750 && input.publishedCount >= 35) return "community_expert";
  if (input.points >= 250 && input.publishedCount >= 12) return "trusted_contributor";
  if (input.points >= 50 && input.approvedCount >= 5) return "community_helper";
  return "new_contributor";
}

export function contributionPoints(resourceType: ContentResourceType): number {
  if (resourceType === "photo" || resourceType === "image") return 12;
  if (resourceType === "arena") return 12;
  if (resourceType === "schedule") return 15;
  return 10;
}


const PROTECTED_CONTENT_FIELDS = new Set([
  "id",
  "clientId",
  "businessBrandId",
  "publisherCode",
  "tenant",
  "resourceType",
  "resourceKey",
  "teamId",
  "publicTeamId",
  "category",
  "division",
  "slug",
  "internalId",
  "externalId",
  "sourceKind",
  "authoritativeSourceId",
  "createdAt",
  "updatedAt",
]);

const EDITABLE_CONTENT_FIELDS: Record<ContentResourceType, readonly string[]> = {
  news: [
    "title","summary","excerpt","body","description","imageUrl","imageAlt",
    "sourceUrl","publishedAt","author","links","tags","text","url",
  ],
  post: [
    "title","summary","excerpt","body","description","imageUrl","imageAlt",
    "sourceUrl","publishedAt","author","links","tags","text","url",
  ],
  photo: [
    "imageUrl","thumbnailUrl","caption","alt","credit","sourceUrl","takenAt",
    "description","tags","url","alt","label",
  ],
  image: [
    "imageUrl","thumbnailUrl","caption","alt","credit","sourceUrl","takenAt",
    "description","tags","url","alt","label",
  ],
  gallery: [
    "title","description","coverImageUrl","coverUrl","photos","sourceUrl","publishedAt","date",
  ],
  schedule: [
    "date","start","end","venue","activity","status","notes","sourceUrl",
    "sourcePage","sourceRow","homeTeam","awayTeam","homeScore","awayScore",
  ],
  arena: [
    "address","website","officialPhotoPage","phone","phoneExtension","description",
    "facilities","activities","amenities","accessibility","parking","publicStatus",
    "photoUrl","photoAlt","sourceUrl","sourceVerifiedAt","directionsNotes",
  ],
  team: [
    "description","heroImageUrl","heroImageAlt","website","scheduleUrl",
    "resultsUrl","socialLinks","contact","gallery","news","notes",
  ],
  page: [
    "title","description","body","heroImageUrl","heroImageAlt","links","sourceUrl","notes",
  ],
  faq: ["question","answer","sourceUrl","links"],
  sponsor: [
    "displayName","description","logoUrl","imageUrl","website","phone","address",
    "ctaLabel","ctaUrl","sourceUrl",
  ],
  other: [
    "title","description","body","imageUrl","imageAlt","sourceUrl","links","notes",
  ],
};

export function editableFieldsForResource(
  resourceType: ContentResourceType,
): readonly string[] {
  return EDITABLE_CONTENT_FIELDS[resourceType];
}

export function contributionPatchPolicy(options: {
  resourceType: ContentResourceType;
  patch: Record<string, unknown>;
  registryEditableFields?: readonly string[];
}): {
  valid: boolean;
  protectedFields: string[];
  disallowedFields: string[];
  editableFields: string[];
} {
  const configured = options.registryEditableFields?.length
    ? options.registryEditableFields
    : editableFieldsForResource(options.resourceType);
  const allowed = new Set(configured.filter((field) => !PROTECTED_CONTENT_FIELDS.has(field)));
  const protectedFields: string[] = [];
  const disallowedFields: string[] = [];

  for (const field of Object.keys(options.patch)) {
    const root = field.split(".")[0]?.trim() ?? "";
    if (!root) {
      disallowedFields.push(field);
      continue;
    }
    if (PROTECTED_CONTENT_FIELDS.has(root)) protectedFields.push(field);
    else if (!allowed.has(root)) disallowedFields.push(field);
  }

  return {
    valid: protectedFields.length === 0 && disallowedFields.length === 0,
    protectedFields,
    disallowedFields,
    editableFields: Array.from(allowed),
  };
}

export type ContributorReward = {
  code: "membership_week_credit";
  thresholdPoints: number;
  weeks: number;
};

export const CONTRIBUTOR_REWARDS: readonly ContributorReward[] = [
  { code: "membership_week_credit", thresholdPoints: 250, weeks: 1 },
  { code: "membership_week_credit", thresholdPoints: 750, weeks: 2 },
  { code: "membership_week_credit", thresholdPoints: 1500, weeks: 4 },
];

export function earnedMembershipWeekMilestones(points: number): number {
  return CONTRIBUTOR_REWARDS
    .filter((reward) => points >= reward.thresholdPoints)
    .reduce((total, reward) => total + reward.weeks, 0);
}
