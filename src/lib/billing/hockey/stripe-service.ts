import "server-only";

import type Stripe from "stripe";

import {
  getAhmvSelfServePlan,
} from "./product-catalog-service";
import {
  HOCKEY_SOURCE_APPLICATION,
  resolveHockeyMembershipAccess,
} from "./membership-policy";
import { isHockeyMembershipCheckoutLive } from "./stripe-env";
import { getHockeyStripe } from "./stripe-client";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

const HOCKEY_BILLING_RETURN_PATH = "/experiences/ahmv";

function checkoutUrls(origin: string) {
  return {
    success: `${origin}${HOCKEY_BILLING_RETURN_PATH}?checkout=success`,
    cancel: `${origin}${HOCKEY_BILLING_RETURN_PATH}?checkout=canceled`,
  };
}

async function requireMasterIdentity(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "Membership billing is temporarily unavailable.");
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: {
      id: true,
      primaryEmail: true,
      firstName: true,
      lastName: true,
      accountStatus: true,
      hockeyMemberships: {
        where: { sourceApplication: HOCKEY_SOURCE_APPLICATION },
        take: 1,
      },
    },
  });

  if (!identity) {
    throw new ServiceError(
      "forbidden",
      "Verify your TAKATAK email or phone before starting an AHMV membership.",
    );
  }

  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  return { prisma, identity, membership: identity.hockeyMemberships[0] ?? null };
}

function stripeInterval(value: string): Stripe.Price.Recurring.Interval | null {
  return value === "day" ||
    value === "week" ||
    value === "month" ||
    value === "year"
    ? value
    : null;
}

async function verifyCatalogStripePrice(input: {
  priceId: string;
  currency: string;
  unitAmountMinor: number;
  billingInterval: string;
  intervalCount: number;
}): Promise<Stripe.Price> {
  const expectedInterval = stripeInterval(input.billingInterval);
  if (!expectedInterval) {
    throw new ServiceError(
      "unavailable",
      "The configured AHMV billing interval is not supported by Stripe.",
    );
  }

  const price = await getHockeyStripe().prices.retrieve(input.priceId);
  const valid =
    price.active &&
    price.currency.toLowerCase() === input.currency.toLowerCase() &&
    price.unit_amount === input.unitAmountMinor &&
    price.recurring?.interval === expectedInterval &&
    (price.recurring.interval_count ?? 1) === input.intervalCount;

  if (!valid) {
    throw new ServiceError(
      "unavailable",
      "The configured AHMV Stripe price does not match the TAKATAK Product Catalog.",
    );
  }

  return price;
}

async function ensureHockeyCustomer(input: {
  identityId: string;
  email: string | null;
  name: string | null;
  currentCustomerId: string | null;
}): Promise<string> {
  const stripe = getHockeyStripe();

  if (input.currentCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(input.currentCustomerId);
      if (!("deleted" in existing && existing.deleted)) return existing.id;
    } catch {
      // Continue with lookup/create.
    }
  }

  try {
    const found = await stripe.customers.search({
      query: `metadata["masterIdentityId"]:"${input.identityId}"`,
      limit: 1,
    });
    if (found.data[0]) return found.data[0].id;
  } catch {
    // Customer search is best effort; create below.
  }

  const customer = await stripe.customers.create({
    ...(input.email ? { email: input.email } : {}),
    ...(input.name ? { name: input.name } : {}),
    metadata: {
      masterIdentityId: input.identityId,
      billingDomain: "hockey_membership",
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
    },
  });

  return customer.id;
}

export async function startHockeyMembershipCheckout(input: {
  authUserId: string;
  planCode: string;
  requestOrigin: string;
}): Promise<{ url: string }> {
  if (!isHockeyMembershipCheckoutLive()) {
    throw new ServiceError(
      "unavailable",
      "AHMV membership checkout is not live yet.",
    );
  }

  const plan = await getAhmvSelfServePlan(input.planCode);
  if (!plan || !plan.price?.providerPriceId || plan.price.provider !== "stripe") {
    throw new ServiceError(
      "not_found",
      "This AHMV plan is not available for self-serve checkout.",
    );
  }

  await verifyCatalogStripePrice({
    priceId: plan.price.providerPriceId,
    currency: plan.price.currency,
    unitAmountMinor: plan.price.unitAmountMinor,
    billingInterval: plan.price.billingInterval,
    intervalCount: plan.price.intervalCount,
  });

  const { prisma, identity, membership } = await requireMasterIdentity(
    input.authUserId,
  );

  if (
    membership &&
    resolveHockeyMembershipAccess(membership.status) === "paid" &&
    membership.externalSubscriptionId
  ) {
    throw new ServiceError(
      "conflict",
      "This identity already has an active AHMV membership.",
    );
  }

  const fullName = [identity.firstName, identity.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const customerId = await ensureHockeyCustomer({
    identityId: identity.id,
    email: identity.primaryEmail,
    name: fullName || null,
    currentCustomerId: membership?.externalCustomerId ?? null,
  });

  await prisma.hockeyMembership.upsert({
    where: {
      identityId_sourceApplication: {
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    },
    update: {
      planCode: plan.code,
      planName: plan.name,
      provider: "stripe",
      externalCustomerId: customerId,
    },
    create: {
      identityId: identity.id,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      status: "incomplete",
      planCode: plan.code,
      planName: plan.name,
      provider: "stripe",
      externalCustomerId: customerId,
    },
  });

  const urls = checkoutUrls(input.requestOrigin);
  const stripe = getHockeyStripe();
  const metadata = {
    masterIdentityId: identity.id,
    sourceApplication: HOCKEY_SOURCE_APPLICATION,
    billingDomain: "hockey_membership",
    productCode: "ahmv",
    planCode: plan.code,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: identity.id,
    line_items: [{ price: plan.price.providerPriceId, quantity: 1 }],
    success_url: urls.success,
    cancel_url: urls.cancel,
    metadata,
    subscription_data: { metadata },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new ServiceError("unavailable", "Stripe did not return a checkout URL.");
  }

  return { url: session.url };
}

export async function startHockeyMembershipPortal(input: {
  authUserId: string;
  requestOrigin: string;
}): Promise<{ url: string }> {
  const { membership } = await requireMasterIdentity(input.authUserId);

  if (!membership?.externalCustomerId) {
    throw new ServiceError(
      "not_found",
      "No Stripe-managed AHMV membership exists for this identity.",
    );
  }

  const stripe = getHockeyStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: membership.externalCustomerId,
    return_url: `${input.requestOrigin}${HOCKEY_BILLING_RETURN_PATH}`,
  });

  if (!session.url) {
    throw new ServiceError(
      "unavailable",
      "Stripe did not return a billing portal URL.",
    );
  }

  return { url: session.url };
}
