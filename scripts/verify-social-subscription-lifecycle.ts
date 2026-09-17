/**
 * Isolated checks for Social subscription lifecycle (paid / blocked).
 * No database. No Stripe. Exit 1 on mismatch.
 */

import {
  resolveEffectiveSocialEntitlements,
  resolveSocialSubscriptionLifecycle,
} from '../src/lib/billing/social/subscription-lifecycle';

type Row = {
  name: string;
  ok: boolean;
  detail: string;
};

const rows: Row[] = [];

function check(name: string, ok: boolean, detail: string) {
  rows.push({ name, ok, detail });

  if (!ok) {
    throw new Error(`${name}: ${detail}`);
  }
}

function main() {
  const now = new Date('2026-08-29T18:00:00.000Z');
  const future = new Date('2026-09-15T18:00:00.000Z');
  const past = new Date('2026-08-01T18:00:00.000Z');

  check(
    'active is paid',
    resolveSocialSubscriptionLifecycle({
      status: 'active',
      now,
    }).access === 'paid',
    'active must keep paid entitlements',
  );

  check(
    'trial is paid',
    resolveSocialSubscriptionLifecycle({
      status: 'trial',
      now,
    }).access === 'paid',
    'trial must keep paid entitlements',
  );

  check(
    'past_due keeps paid access',
    resolveSocialSubscriptionLifecycle({
      status: 'past_due',
      now,
    }).access === 'paid',
    'retries must not block paid access immediately',
  );

  check(
    'grace_period keeps paid access',
    resolveSocialSubscriptionLifecycle({
      status: 'grace_period',
      now,
    }).access === 'paid',
    'grace must keep paid access',
  );

  const cancelingBeforePeriodEnd = resolveSocialSubscriptionLifecycle({
    status: 'active',
    cancelAtPeriodEnd: true,
    currentPeriodEnd: future,
    now,
  });

  check(
    'cancel at period end stays paid until the date',
    cancelingBeforePeriodEnd.displayKey === 'cancel_at_period_end' &&
      cancelingBeforePeriodEnd.access === 'paid',
    'cancel_at_period_end must remain paid until the purchased period ends',
  );

  check(
    'cancel after period end is blocked',
    resolveSocialSubscriptionLifecycle({
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: past,
      now,
    }).access === 'blocked',
    'ended cancellation must require another paid subscription',
  );

  check(
    'canceled with remaining period stays paid',
    resolveSocialSubscriptionLifecycle({
      status: 'canceled',
      currentPeriodEnd: future,
      now,
    }).access === 'paid',
    'canceled should keep paid time already purchased',
  );

  check(
    'canceled with no remaining period is blocked',
    resolveSocialSubscriptionLifecycle({
      status: 'canceled',
      currentPeriodEnd: past,
      now,
    }).access === 'blocked',
    'ended cancellation must not grant Social access',
  );

  check(
    'expired is blocked',
    resolveSocialSubscriptionLifecycle({
      status: 'expired',
      now,
    }).access === 'blocked',
    'expired subscriptions must not grant Social access',
  );

  check(
    'legacy free status is blocked',
    resolveSocialSubscriptionLifecycle({
      status: 'free',
      now,
    }).access === 'blocked',
    'legacy database rows must not restore the removed Free plan',
  );

  for (const status of ['incomplete', 'paused', 'suspended'] as const) {
    check(
      `${status} is blocked`,
      resolveSocialSubscriptionLifecycle({
        status,
        now,
      }).access === 'blocked',
      `${status} must not grant Social access`,
    );
  }

  check(
    'missing row is blocked',
    resolveSocialSubscriptionLifecycle({
      status: null,
      now,
    }).access === 'blocked',
    'no subscription row must not invent access',
  );

  const expiredPaidPlan = resolveEffectiveSocialEntitlements({
    status: 'expired',
    planCode: 'social_advanced_25',
    addOns: {
      xAccountAllowance: 2,
      advancedAnalytics: true,
    },
    now,
  });

  check(
    'expired Advanced falls back to unsubscribed entitlements',
    expiredPaidPlan.effectivePlanCode === 'social_unsubscribed' &&
      expiredPaidPlan.entitlements.brandAllowance === 0 &&
      expiredPaidPlan.entitlements.xConnectionAllowance === 0 &&
      expiredPaidPlan.entitlements.advancedAnalytics === false,
    'a stale paid planCode and add-ons must not retain access after expiry',
  );

  const pastDueStarter = resolveEffectiveSocialEntitlements({
    status: 'past_due',
    planCode: 'social_starter_5',
    now,
  });

  check(
    'past_due still uses Starter entitlements',
    pastDueStarter.effectivePlanCode === 'social_starter_5' &&
      pastDueStarter.entitlements.brandAllowance === 5,
    'the payment retry window must keep the paid plan',
  );

  console.log('Social subscription lifecycle verification');
  console.log('=========================================');

  for (const row of rows) {
    console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${row.name}`);
    console.log(`      ${row.detail}`);
  }

  console.log('');
  console.log(
    `Result: ${
      rows.every((row) => row.ok) ? 'ALL PASS' : 'FAILED'
    } (${rows.length} checks)`,
  );
}

try {
  main();
} catch (error) {
  console.error('FAIL', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
