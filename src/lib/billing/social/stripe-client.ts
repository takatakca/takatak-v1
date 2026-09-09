import "server-only";

import Stripe from "stripe";

import { getStripeSecretKey } from "./stripe-env";
import { ServiceError } from "@/lib/services/service-error";

const globalForStripe = globalThis as unknown as {
  socialStripe?: Stripe;
};

export function getStripe(): Stripe {
  const secret = getStripeSecretKey();

  if (!secret) {
    throw new ServiceError(
      "unavailable",
      "Stripe is not configured for Social billing.",
    );
  }

  if (!globalForStripe.socialStripe) {
    globalForStripe.socialStripe = new Stripe(secret);
  }

  return globalForStripe.socialStripe;
}
