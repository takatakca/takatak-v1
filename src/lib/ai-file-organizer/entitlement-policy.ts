/** Growth billing namespace is reused, but this add-on is NOT purchasable yet. */
export const ORGANIZER_GROWTH_PLAN_KEY = "ai_file_organizer";

export interface OrganizerSubscriptionRow {
  status: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | string | null;
}

/** Fail closed: checkout alone is insufficient; verified subscription period is required. */
export function organizerSubscriptionActive(row: OrganizerSubscriptionRow | null, now = new Date()): boolean {
  if (!row || (row.status !== "active" && row.status !== "trialing") ||
    !row.stripeSubscriptionId || !/^sub_[A-Za-z0-9]+$/.test(row.stripeSubscriptionId)) return false;
  const until = row.currentPeriodEnd instanceof Date ? row.currentPeriodEnd :
    row.currentPeriodEnd ? new Date(row.currentPeriodEnd) : null;
  return Boolean(until && Number.isFinite(until.getTime()) && until.getTime() > now.getTime());
}
