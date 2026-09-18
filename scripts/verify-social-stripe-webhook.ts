/**
 * Isolated checks for Social Stripe checkout and webhook mapping.
 * No Stripe API. No database.
 */

import {
  resolveSocialStripePlanChange,
  resolveSocialCheckoutLive,
  socialPlanRank,
  socialStripePriceEnvKey,
  validateSocialStripeCheckoutInput,
} from '../src/lib/billing/social/stripe-checkout-policy';
import {
  interpretDeletedStripeSubscription,
  interpretFailedStripeInvoice,
  interpretStripeSubscriptionEvent,
  mapStripeSubscriptionStatus,
  resolvePlanCodeFromStripe,
  shouldBlockAfterFailedInvoice,
  SOCIAL_STRIPE_FAILED_PAYMENT_ATTEMPTS,
  stripeSubscriptionPeriod,
} from '../src/lib/billing/social/stripe-webhook-policy';

type Row = { name: string; ok: boolean; detail: string };

const rows: Row[] = [];

function check(name: string, ok: boolean, detail: string) {
  rows.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`${name}: ${detail}`);
  }
}

const priceMap = {
  price_starter5_month: {
    planCode: 'social_starter_5' as const,
    cycle: 'monthly' as const,
  },
  price_advanced15_year: {
    planCode: 'social_advanced_15' as const,
    cycle: 'annual' as const,
  },
};

function main() {
  check(
    'checkout stays off without keys',
    resolveSocialCheckoutLive({
      secretKey: '',
      webhookSecret: 'whsec_test',
      hasPrice: true,
    }) === false,
    'missing secret key must keep buttons disabled',
  );

  check(
    'checkout stays off without a price',
    resolveSocialCheckoutLive({
      secretKey: 'sk_test_x',
      webhookSecret: 'whsec_test',
      hasPrice: false,
    }) === false,
    'keys without Price IDs must keep buttons disabled',
  );

  check(
    'checkout live with keys and a price',
    resolveSocialCheckoutLive({
      secretKey: 'sk_test_x',
      webhookSecret: 'whsec_test',
      hasPrice: true,
    }) === true,
    'secret, webhook secret, and one Price ID enable checkout',
  );

  check(
    'price env key name',
    socialStripePriceEnvKey('social_starter_5', 'monthly') ===
      'STRIPE_PRICE_SOCIAL_STARTER_5_MONTHLY',
    'Price IDs must use the catalog plan code',
  );

  const custom = validateSocialStripeCheckoutInput({
    planCode: 'social_custom',
    billingCycle: 'monthly',
  });
  check(
    'Custom is not self-serve checkout',
    custom.success === false,
    'Custom must stay Talk to us',
  );

  const unsubscribed = validateSocialStripeCheckoutInput({
    planCode: 'social_unsubscribed',
    billingCycle: 'monthly',
  });

  check(
    'unsubscribed is not a Stripe checkout plan',
    unsubscribed.success === false,
    'the internal unsubscribed state must not open Checkout',
  );

  const starter = validateSocialStripeCheckoutInput({
    planCode: 'social_starter_5',
    billingCycle: 'annual',
  });
  check(
    'Starter annual is a valid checkout request',
    starter.success === true,
    'Starter 5 annual should pass validation',
  );

  check(
    'unsubscribed to Starter uses Checkout',
    resolveSocialStripePlanChange({
      currentPlanCode: 'social_unsubscribed',
      targetPlanCode: 'social_starter_5',
      hasStripeSubscription: false,
      currentAccess: 'blocked',
    }) === 'checkout',
    'a blocked workspace must wait for the Stripe webhook before unlocking',
  );

  check(
    'paid Starter to Advanced is an immediate upgrade',
    resolveSocialStripePlanChange({
      currentPlanCode: 'social_starter_5',
      targetPlanCode: 'social_advanced_15',
      hasStripeSubscription: true,
      currentAccess: 'paid',
    }) === 'upgrade',
    'higher rank must prorate immediately',
  );

  check(
    'paid Advanced to Starter is a period-end downgrade',
    resolveSocialStripePlanChange({
      currentPlanCode: 'social_advanced_15',
      targetPlanCode: 'social_starter_5',
      hasStripeSubscription: true,
      currentAccess: 'paid',
    }) === 'downgrade',
    'lower rank must wait until period end',
  );

  check(
    'Advanced ranks above Starter',
    socialPlanRank('social_advanced_15') > socialPlanRank('social_starter_10'),
    'family rank must beat brand count when comparing Starter 10 to Advanced 15',
  );

  check(
    'incomplete Stripe status is skipped',
    mapStripeSubscriptionStatus('incomplete') === 'skip',
    'incomplete must not lock a workspace that just clicked Upgrade',
  );

  check(
    'unpaid maps to expired',
    mapStripeSubscriptionStatus('unpaid') === 'expired',
    'Stripe unpaid must block Social access after retries are exhausted',
  );

  const active = interpretStripeSubscriptionEvent(
    {
      id: 'sub_1',
      status: 'active',
      customer: 'cus_1',
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: { id: 'price_starter5_month' },
            current_period_start: 1_700_000_000,
            current_period_end: 1_702_592_000,
          },
        ],
      },
      metadata: { planCode: 'social_starter_5' },
    },
    priceMap,
  );
  check(
    'active subscription unlocks Starter',
    active.action === 'apply' &&
      active.patch.status === 'active' &&
      active.patch.planCode === 'social_starter_5' &&
      active.forceCancelStripe === false,
    'webhook apply from active + metadata must set Starter',
  );

  const period = stripeSubscriptionPeriod({
    id: 'sub_item_period',
    status: 'active',
    items: {
      data: [
        {
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
        },
      ],
    },
  });
  check(
    'period comes from subscription items',
    Boolean(period.start && period.end),
    'Stripe v22 stores current_period_end on the item',
  );

  const incomplete = interpretStripeSubscriptionEvent(
    {
      id: 'sub_incomplete',
      status: 'incomplete',
      customer: 'cus_1',
      metadata: { planCode: 'social_starter_5' },
    },
    priceMap,
  );
  check(
    'incomplete event does not write incomplete locally',
    incomplete.action === 'skip',
    'leave the workspace blocked until payment confirms',
  );

  check(
    'plan from Price ID when metadata is missing',
    resolvePlanCodeFromStripe({
      metadataPlanCode: null,
      priceId: 'price_advanced15_year',
      priceMap,
    }) === 'social_advanced_15',
    'Price ID reverse map must recover the plan',
  );

  check(
    'retry limit blocks Social access',
    shouldBlockAfterFailedInvoice(SOCIAL_STRIPE_FAILED_PAYMENT_ATTEMPTS) &&
      !shouldBlockAfterFailedInvoice(2),
    `attempt_count ${SOCIAL_STRIPE_FAILED_PAYMENT_ATTEMPTS} blocks access; 2 stays past due`,
  );

  const retrying = interpretFailedStripeInvoice({
    attemptCount: 2,
    subscription: {
      id: 'sub_due',
      status: 'past_due',
      customer: 'cus_1',
      metadata: { planCode: 'social_starter_5' },
      items: { data: [{ price: { id: 'price_starter5_month' } }] },
    },
    priceMap,
  });
  check(
    'failed invoice during retries keeps the paid plan',
    retrying.action === 'apply' &&
      retrying.patch.status === 'past_due' &&
      retrying.patch.planCode === 'social_starter_5' &&
      retrying.forceCancelStripe === false,
    'past due must keep paid access during the retry window',
  );

  const exhausted = interpretFailedStripeInvoice({
    attemptCount: 5,
    subscription: {
      id: 'sub_dead',
      status: 'past_due',
      customer: 'cus_1',
      metadata: { planCode: 'social_starter_5' },
    },
    priceMap,
  });
  check(
    'fifth failed invoice blocks Social access',
    exhausted.action === 'apply' &&
      exhausted.patch.status === 'expired' &&
      exhausted.patch.planCode === 'social_unsubscribed' &&
      exhausted.forceCancelStripe === true,
    'exhausted retries must block the workspace and cancel Stripe',
  );

  const deleted = interpretDeletedStripeSubscription({
    id: 'sub_gone',
    status: 'canceled',
    customer: 'cus_1',
  });
  check(
    'deleted subscription becomes unsubscribed and clears the Stripe sub id',
    deleted.action === 'apply' &&
      deleted.patch.status === 'expired' &&
      deleted.patch.planCode === 'social_unsubscribed' &&
      deleted.patch.externalSubscriptionId === null &&
      deleted.patch.externalCustomerId === 'cus_1',
    'keep the customer id, block access, and drop the subscription id',
  );

  console.log(`verify-social-stripe-webhook: ${rows.length} checks passed`);
}

main();
