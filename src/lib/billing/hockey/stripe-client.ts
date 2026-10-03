import "server-only";

import Stripe from "stripe";

import { getStripeSecretKey } from "@/lib/billing/social/stripe-env";
import { ServiceError } from "@/lib/services/service-error";

const globalForStripe = globalThis as unknown as {
  hockeyStripe?: Stripe;
};

export function getHockeyStripe(): Stripe {
  const secret = getStripeSecretKey();

  if (!secret) {
    throw new ServiceError(
      "unavailable",
      "Stripe is not configured for hockey membership billing.",
    );
  }

  if (!globalForStripe.hockeyStripe) {
    globalForStripe.hockeyStripe = new Stripe(secret);
  }

  return globalForStripe.hockeyStripe;
}
