// GROUPE TAKATAK Billing — signed machine feed for ecosystem apps hosted
// outside this repository (FoodHub, FESTI-ICE, …). Pure module, shared by
// the TAKATAK route and by the reference client in the docs.
//
// Each app has its OWN secret (BILLING_FEED_SECRET_<APP>). The app is the one
// whose secret verifies the signature; the request body can never choose it.
//
//   X-Takatak-Billing-App:        foodhub
//   X-Takatak-Billing-Timestamp:  1790000000            (unix seconds)
//   X-Takatak-Billing-Signature:  v1=<hex HMAC-SHA256>
//
// signed string = "v1.<app>.<timestamp>.<METHOD>.<path + query>.<raw body>"
// (GET status lookups sign an empty body; the query is part of the path.)

import { createHmac, timingSafeEqual } from "node:crypto";

import { BILLING_SOURCE_APPS, type BillingSourceApp } from "./source-apps";

export const BILLING_FEED_TOLERANCE_SECONDS = 300;
export const BILLING_FEED_MIN_SECRET_LENGTH = 32;
export const BILLING_FEED_HEADERS = {
  app: "x-takatak-billing-app",
  timestamp: "x-takatak-billing-timestamp",
  signature: "x-takatak-billing-signature",
} as const;

/** Apps allowed on the machine feed. "manual" is the admin UI only. */
export const BILLING_FEED_APPS = BILLING_SOURCE_APPS.filter(
  (app): app is Exclude<BillingSourceApp, "manual"> => app !== "manual",
);
export type BillingFeedApp = (typeof BILLING_FEED_APPS)[number];

export function billingFeedSecretEnvName(app: BillingFeedApp): string {
  return `BILLING_FEED_SECRET_${app.toUpperCase()}`;
}

export function billingFeedSignedString(input: {
  app: string;
  timestamp: string;
  method: string;
  path: string;
  rawBody: string;
}): string {
  return ["v1", input.app, input.timestamp, input.method.toUpperCase(), input.path, input.rawBody].join(".");
}

export function signBillingFeedRequest(input: {
  app: string;
  secret: string;
  timestamp: string;
  method: string;
  path: string;
  rawBody: string;
}): string {
  return `v1=${createHmac("sha256", input.secret).update(billingFeedSignedString(input), "utf8").digest("hex")}`;
}

export type BillingFeedVerification =
  | { ok: true; app: BillingFeedApp }
  | { ok: false; status: 401 | 503; code: string };

export function verifyBillingFeedRequest(input: {
  app: string | null;
  timestamp: string | null;
  signature: string | null;
  method: string;
  path: string;
  rawBody: string;
  nowMs: number;
  secretFor: (app: BillingFeedApp) => string;
}): BillingFeedVerification {
  const app = (BILLING_FEED_APPS as readonly string[]).includes(input.app ?? "")
    ? (input.app as BillingFeedApp)
    : null;

  if (!app) {
    return { ok: false, status: 401, code: "UNKNOWN_BILLING_APP" };
  }

  const secret = input.secretFor(app);

  if (secret.length < BILLING_FEED_MIN_SECRET_LENGTH) {
    return { ok: false, status: 503, code: "BILLING_FEED_NOT_CONFIGURED" };
  }

  if (!input.timestamp || !/^[0-9]{1,12}$/.test(input.timestamp)) {
    return { ok: false, status: 401, code: "INVALID_BILLING_TIMESTAMP" };
  }

  if (Math.abs(Math.floor(input.nowMs / 1000) - Number(input.timestamp)) > BILLING_FEED_TOLERANCE_SECONDS) {
    return { ok: false, status: 401, code: "BILLING_TIMESTAMP_OUT_OF_TOLERANCE" };
  }

  const match = /^v1=([a-f0-9]{64})$/.exec(input.signature ?? "");

  if (!match) {
    return { ok: false, status: 401, code: "INVALID_BILLING_SIGNATURE" };
  }

  const expected = Buffer.from(
    signBillingFeedRequest({ ...input, app, secret, timestamp: input.timestamp }).slice(3),
    "hex",
  );
  const received = Buffer.from(match[1], "hex");

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, status: 401, code: "INVALID_BILLING_SIGNATURE" };
  }

  return { ok: true, app };
}
