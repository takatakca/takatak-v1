import "server-only";

import type Stripe from "stripe";

import { HOCKEY_MEMBERSHIP_CATALOG, type HockeySelfServePlanCode } from "./plan-catalog";
import { HOCKEY_SOURCE_APPLICATION, resolveHockeyMembershipAccess } from "./membership-policy";
import {
  getHockeyStripePriceId,
  isHockeyMembershipCheckoutLive,
} from "./stripe-env";
import { getHockeyStripe } from "./stripe-client";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

const HOCKEY_BILLING_RETURN_PATH = "/dashboard?service=ahmv-membership";

function checkoutUrls(origin: string) {
  return {
    success: `${origin}${HOCKEY_BILLING_RETURN_PATH}&checkout=success`,
    cancel: `${origin}${HOCKEY_BILLING_RETURN_PATH}&checkout=canceled`,
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

async function verifyWeeklyMemberPrice(
  priceId: string,
): Promise<Stripe.Price> {
  const stripe = getHockeyStripe();
  const price = await stripe.prices.retrieve(priceId);

  const valid =
    price.active &&
    price.currency.toLowerCase() === "cad" &&
    price.unit_amount === 1000 &&
    price.recurring?.interval === "week" &&
    (price.recurring.interval_count ?? 1) === 1;

  if (!valid) {
    throw new ServiceError(
      "unavailable",
      "The AHMV Member Stripe price is misconfigured. Expected CAD 10.00 billed weekly.",
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
  planCode: HockeySelfServePlanCode;
  requestOrigin: string;
}): Promise<{ url: string }> {
  if (!isHockeyMembershipCheckoutLive()) {
    throw new ServiceError(
      "unavailable",
      "AHMV membership checkout is not live yet.",
    );
  }

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

  const priceId = getHockeyStripePriceId(input.planCode);
  if (!priceId) {
    throw new ServiceError("unavailable", "The AHMV membership price is not configured.");
  }

  await verifyWeeklyMemberPrice(priceId);

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

  const plan = HOCKEY_MEMBERSHIP_CATALOG[input.planCode];

  await prisma.hockeyMembership.upsert({
    where: {
      identityId_sourceApplication: {
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    },
    update: {
      planCode: plan.planCode,
      planName: plan.planName,
      provider: "stripe",
      externalCustomerId: customerId,
    },
    create: {
      identityId: identity.id,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      status: "incomplete",
      planCode: plan.planCode,
      planName: plan.planName,
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
    planCode: plan.planCode,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: identity.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: urls.success,
    cancel_url: urls.cancel,
    metadata,
    subscription_data: { metadata },
    allow_promotion_codes: false,
  });

  if (!session.url) {
    throw new ServiceError("unavailable", "Stripe did not return a checkout URL.");
  }

  return { url: session.url };
}
