export const SUPPORTER_THANK_YOU_WEEKS = 4 as const;
export const SUPPORTER_GRANT_TYPE = "supporter_thank_you" as const;
export const SUPPORTER_GRANT_PLAN_CODE = "hockey_member_weekly_10" as const;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function supporterGrantExpiresAt(
  activatedAt: Date,
  weeks = SUPPORTER_THANK_YOU_WEEKS,
): Date {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
    throw new Error("invalid_supporter_grant_weeks");
  }
  return new Date(activatedAt.getTime() + weeks * WEEK_MS);
}

export function isActiveSupporterGrant(
  grant: {
    status: string;
    activatedAt: Date | null;
    expiresAt: Date | null;
    revokedAt?: Date | null;
  },
  now = new Date(),
): boolean {
  return Boolean(
    grant.status === "active" &&
      !grant.revokedAt &&
      grant.activatedAt &&
      grant.activatedAt.getTime() <= now.getTime() &&
      grant.expiresAt &&
      grant.expiresAt.getTime() > now.getTime(),
  );
}

export function shouldActivateSupporterGrantImmediately(input: {
  paidMembershipAccess: boolean;
  hasActiveComplimentaryGrant: boolean;
}): boolean {
  return !input.paidMembershipAccess && !input.hasActiveComplimentaryGrant;
}
