/**
 * Isolated verification for Social connection subscription policy and
 * production-proof development bypass.
 *
 * Does not invent paid status. Does not accept browser preview values.
 */

import {
  evaluateClientSocialConnectionAccess,
  isProductionSocialRuntime,
  isTrustedSocialConnectionDevBypassEnabled,
} from '../src/lib/billing/client-subscription-access-policy';

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
  check(
    'active subscription allowed without bypass',
    evaluateClientSocialConnectionAccess({
      status: 'active',
      developmentBypass: false,
      nodeEnv: 'production',
      vercelEnv: 'production',
      serverDevBypassFlag: null,
    }).allowed === true,
    'active must remain allowed in production',
  );

  check(
    'trial subscription allowed without bypass',
    evaluateClientSocialConnectionAccess({
      status: 'trial',
      developmentBypass: false,
      nodeEnv: 'production',
      vercelEnv: 'production',
      serverDevBypassFlag: null,
    }).via === 'subscription',
    'trial must use the paid subscription path',
  );

  check(
    'legacy free subscription is denied in production',
    evaluateClientSocialConnectionAccess({
      status: 'free',
      developmentBypass: false,
      nodeEnv: 'production',
      vercelEnv: 'production',
      serverDevBypassFlag: null,
    }).allowed === false,
    'the removed Free status must not permit Social connections',
  );

  check(
    'expired subscription is denied in production',
    evaluateClientSocialConnectionAccess({
      status: 'expired',
      developmentBypass: false,
      nodeEnv: 'production',
      vercelEnv: 'production',
      serverDevBypassFlag: null,
    }).allowed === false,
    'expired subscriptions must remain locked',
  );

  check(
    'past_due keeps access in production',
    evaluateClientSocialConnectionAccess({
      status: 'past_due',
      developmentBypass: false,
      nodeEnv: 'production',
      vercelEnv: 'production',
      serverDevBypassFlag: null,
    }).allowed === true,
    'the payment retry window must keep paid access',
  );

  check(
    'grace_period keeps access in production',
    evaluateClientSocialConnectionAccess({
      status: 'grace_period',
      developmentBypass: false,
      nodeEnv: 'production',
      vercelEnv: 'production',
      serverDevBypassFlag: null,
    }).allowed === true,
    'the payment grace period must keep paid access',
  );

  for (const status of ['incomplete', 'paused', 'suspended'] as const) {
    check(
      `${status} denied in production even with DB and environment bypass`,
      evaluateClientSocialConnectionAccess({
        status,
        developmentBypass: true,
        nodeEnv: 'production',
        vercelEnv: 'production',
        serverDevBypassFlag: 'true',
      }).allowed === false,
      'production must ignore development bypass flags on blocked statuses',
    );
  }

  check(
    'NODE_ENV production blocks bypass',
    evaluateClientSocialConnectionAccess({
      status: 'suspended',
      developmentBypass: true,
      nodeEnv: 'production',
      vercelEnv: 'preview',
      serverDevBypassFlag: 'true',
    }).allowed === false,
    'NODE_ENV production alone must deny blocked statuses',
  );

  check(
    'VERCEL_ENV production blocks bypass',
    evaluateClientSocialConnectionAccess({
      status: 'suspended',
      developmentBypass: true,
      nodeEnv: 'development',
      vercelEnv: 'production',
      serverDevBypassFlag: 'true',
    }).allowed === false,
    'VERCEL_ENV production alone must deny blocked statuses',
  );

  check(
    'production runtime helper covers both signals',
    isProductionSocialRuntime('production', null) &&
      isProductionSocialRuntime('development', 'production') &&
      !isProductionSocialRuntime('development', 'preview'),
    'the runtime helper must detect either production signal',
  );

  check(
    'non-production runtime allows OAuth through trusted bypass',
    evaluateClientSocialConnectionAccess({
      status: 'expired',
      developmentBypass: false,
      nodeEnv: 'development',
      vercelEnv: null,
      serverDevBypassFlag: null,
    }).via === 'trusted_dev_bypass',
    'the server runtime may permit local OAuth testing without inventing paid status',
  );

  check(
    'browser preview is not an access input',
    !isTrustedSocialConnectionDevBypassEnabled({
      developmentBypass: false,
      nodeEnv: 'production',
      vercelEnv: 'production',
      serverDevBypassFlag: null,
    }),
    'production cannot be unlocked by a client preview value',
  );

  check(
    'require-subscription flag forces checks outside production',
    evaluateClientSocialConnectionAccess({
      status: 'suspended',
      developmentBypass: false,
      nodeEnv: 'development',
      vercelEnv: null,
      serverDevBypassFlag: null,
      requireSubscriptionFlag: 'true',
    }).allowed === false,
    'the require-subscription flag must deny blocked access without an explicit bypass',
  );

  check(
    'require-subscription flag disables default non-production bypass',
    !isTrustedSocialConnectionDevBypassEnabled({
      developmentBypass: false,
      nodeEnv: 'development',
      vercelEnv: null,
      serverDevBypassFlag: null,
      requireSubscriptionFlag: 'true',
    }),
    'SOCIAL_CONNECTION_REQUIRE_SUBSCRIPTION=true must require a real subscription or explicit server bypass',
  );

  check(
    'explicit database bypass works outside production',
    isTrustedSocialConnectionDevBypassEnabled({
      developmentBypass: true,
      nodeEnv: 'development',
      vercelEnv: null,
      serverDevBypassFlag: null,
      requireSubscriptionFlag: 'true',
    }),
    'the database developmentBypass may unlock testing only outside production',
  );

  check(
    'explicit environment bypass works outside production',
    isTrustedSocialConnectionDevBypassEnabled({
      developmentBypass: false,
      nodeEnv: 'development',
      vercelEnv: null,
      serverDevBypassFlag: 'true',
      requireSubscriptionFlag: 'true',
    }),
    'the trusted environment bypass may unlock testing only outside production',
  );

  console.log('Social connection access policy verification');
  console.log('===========================================');

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
