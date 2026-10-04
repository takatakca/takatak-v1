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
