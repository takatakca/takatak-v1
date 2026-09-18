import { resolveSocialEntitlements } from './entitlements';

import { SOCIAL_UNSUBSCRIBED_PLAN_CODE } from './plan-catalog';

import type {
  SocialAddonState,
  SocialEntitlements,
  SocialPlanCode,
} from './types';

export const SOCIAL_SUBSCRIPTION_STATUSES = [
  'incomplete',
  'trial',
  'active',
  'past_due',
  'grace_period',
  'canceled',
  'expired',
  /**
   * Legacy database status only.
   * It grants no access and is not a customer plan.
   */
  'free',
  'paused',
  'suspended',
] as const;

export type SocialSubscriptionStatusName =
  (typeof SOCIAL_SUBSCRIPTION_STATUSES)[number];

export type SocialSubscriptionAccess = 'paid' | 'blocked';

export type SocialSubscriptionLifecycle = {
  access: SocialSubscriptionAccess;
  status: SocialSubscriptionStatusName | null;
  displayKey: SocialSubscriptionStatusName | 'cancel_at_period_end' | 'missing';
  label: string;
  paidUntil: Date | null;
};

export type ResolveSocialSubscriptionLifecycleInput = {
  status?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | string | null;
  now?: Date;
};

const LABELS: Record<SocialSubscriptionLifecycle['displayKey'], string> = {
  incomplete: 'Checkout incomplete',
  trial: 'Trial',
  active: 'Active',
  past_due: 'Payment past due',
  grace_period: 'Payment retry',
  canceled: 'Canceled',
  expired: 'Expired',
  free: 'Subscription required',
  paused: 'Paused',
  suspended: 'Suspended',
  cancel_at_period_end: 'Cancels at period end',
  missing: 'No active Social subscription',
};

function isSocialSubscriptionStatus(
  value: string | null | undefined,
): value is SocialSubscriptionStatusName {
  return (
    typeof value === 'string' &&
    (SOCIAL_SUBSCRIPTION_STATUSES as readonly string[]).includes(value)
  );
}

function parsePeriodEnd(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function periodStillOpen(periodEnd: Date | null, now: Date): boolean {
  return Boolean(periodEnd && periodEnd.getTime() > now.getTime());
}

function blockedLifecycle(input: {
  status: SocialSubscriptionStatusName | null;
  displayKey: SocialSubscriptionLifecycle['displayKey'];
}): SocialSubscriptionLifecycle {
  return {
    access: 'blocked',
    status: input.status,
    displayKey: input.displayKey,
    label: LABELS[input.displayKey],
    paidUntil: null,
  };
}

export function resolveSocialSubscriptionLifecycle(
  input: ResolveSocialSubscriptionLifecycleInput = {},
): SocialSubscriptionLifecycle {
  const now = input.now ?? new Date();
  const periodEnd = parsePeriodEnd(input.currentPeriodEnd);

  const status = isSocialSubscriptionStatus(input.status) ? input.status : null;

  if (!status) {
    return blockedLifecycle({
      status: null,
      displayKey: 'missing',
    });
  }

  if (
    status === 'incomplete' ||
    status === 'paused' ||
    status === 'suspended'
  ) {
    return blockedLifecycle({
      status,
      displayKey: status,
    });
  }

  if (status === 'trial' || status === 'active') {
    if (input.cancelAtPeriodEnd && periodStillOpen(periodEnd, now)) {
      return {
        access: 'paid',
        status,
        displayKey: 'cancel_at_period_end',
        label: LABELS.cancel_at_period_end,
        paidUntil: periodEnd,
      };
    }

    if (input.cancelAtPeriodEnd && !periodStillOpen(periodEnd, now)) {
      return blockedLifecycle({
        status,
        displayKey: 'expired',
      });
    }

    return {
      access: 'paid',
      status,
      displayKey: status,
      label: LABELS[status],
      paidUntil: periodEnd,
    };
  }

  if (status === 'past_due' || status === 'grace_period') {
    return {
      access: 'paid',
      status,
      displayKey: status,
      label: LABELS[status],
      paidUntil: periodEnd,
    };
  }

  if (status === 'canceled') {
    if (periodStillOpen(periodEnd, now)) {
      return {
        access: 'paid',
        status,
        displayKey: 'cancel_at_period_end',
        label: LABELS.cancel_at_period_end,
        paidUntil: periodEnd,
      };
    }

    return blockedLifecycle({
      status,
      displayKey: 'canceled',
    });
  }

  if (status === 'expired') {
    return blockedLifecycle({
      status,
      displayKey: 'expired',
    });
  }

  /*
   * Legacy "free" rows reach this branch.
   * They are blocked and receive no Social entitlements.
   */
  return blockedLifecycle({
    status: 'free',
    displayKey: 'free',
  });
}

export function socialSubscriptionStatusLabel(
  displayKey: SocialSubscriptionLifecycle['displayKey'],
): string {
  return LABELS[displayKey];
}

export function resolveEffectiveSocialEntitlements(input: {
  status?: string | null;
  planCode?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | string | null;
  addOns?: Partial<SocialAddonState>;
  customBrandAllowance?: number;
  now?: Date;
}): {
  lifecycle: SocialSubscriptionLifecycle;
  entitlements: SocialEntitlements;
  effectivePlanCode: SocialPlanCode;
} {
  const lifecycle = resolveSocialSubscriptionLifecycle(input);

  const paid = lifecycle.access === 'paid';

  const entitlements = resolveSocialEntitlements({
    planCode: paid ? input.planCode : SOCIAL_UNSUBSCRIBED_PLAN_CODE,
    addOns: paid ? input.addOns : undefined,
    customBrandAllowance: paid ? input.customBrandAllowance : undefined,
  });

  return {
    lifecycle,
    entitlements,
    effectivePlanCode: entitlements.planCode,
  };
}
