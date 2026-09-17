/**
 * Isolated checks for the Social billing banner and lock copy.
 * No database. No Stripe.
 */

import { resolveSocialEntitlements } from '../src/lib/billing/social/entitlements';
import {
  resolveSocialBillingBanner,
  socialFeatureLockRows,
} from '../src/lib/billing/social/billing-banner-policy';

type Row = { name: string; ok: boolean; detail: string };

const rows: Row[] = [];

function check(name: string, ok: boolean, detail: string) {
  rows.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`${name}: ${detail}`);
  }
}

function main() {
  const essential = resolveSocialEntitlements({
    planCode: 'social_essential_1',
  });
  const starter = resolveSocialEntitlements({ planCode: 'social_starter_5' });
  const advanced = resolveSocialEntitlements({
    planCode: 'social_advanced_15',
  });

  const essentialBanner = resolveSocialBillingBanner({
    access: 'paid',
    statusLabel: 'Active',
    planName: 'Social Essential',
    cancelAtPeriodEnd: false,
    periodEndLabel: null,
    overAllowance: false,
    brandAllowance: 1,
    billableCount: 1,
  });

  check(
    'healthy Essential plan has no banner',
    essentialBanner === null,
    'an active paid Essential workspace should not show a billing warning',
  );

  const blocked = resolveSocialBillingBanner({
    access: 'blocked',
    statusLabel: 'Suspended',
    planName: 'No Social subscription',
    cancelAtPeriodEnd: false,
    periodEndLabel: null,
    overAllowance: true,
    brandAllowance: 0,
    billableCount: 2,
  });
  check(
    'blocked outranks brand-freeze messaging',
    Boolean(blocked && blocked.tone === 'danger'),
    'suspended workspaces must show the lock banner first',
  );

  const pastDue = resolveSocialBillingBanner({
    access: 'paid',
    statusLabel: 'Payment past due',
    planName: 'Starter 5',
    cancelAtPeriodEnd: false,
    periodEndLabel: '2026-09-15',
    overAllowance: false,
    brandAllowance: 5,
    billableCount: 2,
  });
  check(
    'past due warns without blocking paid access',
    Boolean(
      pastDue && pastDue.tone === 'warning' && /retries/.test(pastDue.body),
    ),
    'past due must keep paid access messaging',
  );

  const freeze = resolveSocialBillingBanner({
    access: 'paid',
    statusLabel: 'Active',
    planName: 'Social Essential',
    cancelAtPeriodEnd: false,
    periodEndLabel: null,
    overAllowance: true,
    brandAllowance: 1,
    billableCount: 3,
  });
  check(
    'too many brands warns on Essential',
    Boolean(
      freeze &&
      freeze.tone === 'warning' &&
      freeze.actionLabel === 'Choose brands',
    ),
    'over-allowance must ask the owner to pick brands',
  );

  const canceling = resolveSocialBillingBanner({
    access: 'paid',
    statusLabel: 'Cancels at period end',
    planName: 'Advanced 15',
    cancelAtPeriodEnd: true,
    periodEndLabel: '2026-09-30',
    overAllowance: false,
    brandAllowance: 15,
    billableCount: 2,
  });
  check(
    'cancel at period end names the date',
    Boolean(
      canceling &&
      canceling.tone === 'info' &&
      /2026-09-30/.test(canceling.body),
    ),
    'cancel-at-period-end should keep paid time visible',
  );

  const quiet = resolveSocialBillingBanner({
    access: 'paid',
    statusLabel: 'Active',
    planName: 'Starter 5',
    cancelAtPeriodEnd: false,
    periodEndLabel: '2026-09-30',
    overAllowance: false,
    brandAllowance: 5,
    billableCount: 2,
  });
  check(
    'healthy paid plan has no banner',
    quiet === null,
    'Active Starter should not nag',
  );

  const essentialLocks = socialFeatureLockRows(essential);
  check(
    'Essential lock copy names the required upgrades',
    essentialLocks.find((row) => row.id === 'linkedin')?.included === false &&
      essentialLocks.find((row) => row.id === 'linkedin')?.unlock ===
        'Starter or Advanced' &&
      essentialLocks.find((row) => row.id === 'teams')?.unlock ===
        'Advanced or Custom' &&
      essentialLocks.find((row) => row.id === 'x')?.unlock ===
        'Starter+ with the X add-on',
    'each locked row must identify the required plan or add-on',
  );

  const starterLocks = socialFeatureLockRows(starter);
  check(
    'Starter includes LinkedIn and reports, not teams',
    starterLocks.find((row) => row.id === 'linkedin')?.included === true &&
      starterLocks.find((row) => row.id === 'reports')?.included === true &&
      starterLocks.find((row) => row.id === 'teams')?.included === false &&
      starterLocks.find((row) => row.id === 'x')?.unlock === 'X add-on',
    'Starter lock rows must match the catalog',
  );

  const advancedLocks = socialFeatureLockRows(advanced);
  check(
    'Advanced includes teams and API',
    advancedLocks.find((row) => row.id === 'teams')?.included === true &&
      advancedLocks.find((row) => row.id === 'api')?.included === true,
    'Advanced should show teams and API as included',
  );

  console.log('Social billing banner verification');
  console.log('==================================');
  for (const row of rows) {
    console.log(`PASS  ${row.name}`);
    console.log(`      ${row.detail}`);
  }
  console.log('');
  console.log(`Result: ALL PASS (${rows.length} checks)`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
