import "server-only";

// GROUPE TAKATAK Billing — signed machine feed entry points. The verified app
// is the request's sourceApp; the body supplies only the reference, the
// optional TAKATAK client and the draft. Everything is re-validated by
// enqueueInvoiceRequest(). Nothing here talks to Facturations: a TAKATAK
// OWNER still reviews and submits every request.

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

import {
  BILLING_FEED_HEADERS,
  billingFeedSecretEnvName,
  verifyBillingFeedRequest,
  type BillingFeedApp,
  type BillingFeedVerification,
} from "./feed-signature";
import { enqueueInvoiceRequest } from "./invoice-request-service";
import { isSourceReference } from "./source-apps";

export const BILLING_FEED_MAX_BODY_BYTES = 64_000;

export function billingFeedClientLinkingEnvName(app: BillingFeedApp): string {
  return `BILLING_FEED_CLIENT_LINKING_${app.toUpperCase()}`;
}

const FEED_BODY_KEYS = new Set(["sourceReference", "clientId", "draft"]);

export function verifyBillingFeedHeaders(input: {
  headers: Headers;
  method: string;
  path: string;
  rawBody: string;
}): BillingFeedVerification {
  return verifyBillingFeedRequest({
    app: input.headers.get(BILLING_FEED_HEADERS.app),
    timestamp: input.headers.get(BILLING_FEED_HEADERS.timestamp),
    signature: input.headers.get(BILLING_FEED_HEADERS.signature),
    method: input.method,
    path: input.path,
    rawBody: input.rawBody,
    nowMs: Date.now(),
    secretFor: (app) => process.env[billingFeedSecretEnvName(app)]?.trim() ?? "",
  });
}

export interface BillingFeedRequestView {
  id: string;
  sourceApp: string;
  sourceReference: string;
  status: string;
  submitted: boolean;
}

function view(row: { id: string; sourceApp: string; sourceReference: string; status: string }): BillingFeedRequestView {
  return {
    id: row.id,
    sourceApp: row.sourceApp,
    sourceReference: row.sourceReference,
    status: row.status,
    submitted: row.status === "submitted",
  };
}

export async function feedInvoiceRequest(
  app: BillingFeedApp,
  body: unknown,
): Promise<{ request: BillingFeedRequestView; created: boolean }> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ServiceError("invalid_input", "JSON object required.");
  }

  const record = body as Record<string, unknown>;
  const unknownKey = Object.keys(record).find((key) => !FEED_BODY_KEYS.has(key));

  if (unknownKey) {
    // sourceApp in particular: the verified signature decides it.
    throw new ServiceError("invalid_input", `Unexpected field: ${unknownKey.slice(0, 40)}.`);
  }

  const clientId = record.clientId ?? null;

  // Linking a request to a TAKATAK workspace makes it, once issued, a payable
  // invoice in that workspace. Only apps explicitly trusted for it may do so.
  if (clientId !== null && process.env[billingFeedClientLinkingEnvName(app)]?.trim() !== "1") {
    throw new ServiceError("invalid_input", "clientId is not enabled for this app.");
  }

  const result = await enqueueInvoiceRequest(
    {
      sourceApp: app,
      sourceReference: record.sourceReference as string,
      clientId: clientId as string | null,
      draft: record.draft as never,
    },
    { profileId: null },
  );

  return { request: view(result.request), created: result.created };
}

export async function getFedInvoiceRequest(
  app: BillingFeedApp,
  sourceReference: string,
): Promise<BillingFeedRequestView> {
  if (!isSourceReference(sourceReference)) {
    throw new ServiceError("not_found", "Invoice request not found.");
  }

  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError("unavailable", "Billing is temporarily unavailable.");
  }

  // Scoped to the verified app: one app can never read another app's requests.
  const row = await prisma.billingInvoiceRequest.findUnique({
    where: { sourceApp_sourceReference: { sourceApp: app, sourceReference } },
    select: { id: true, sourceApp: true, sourceReference: true, status: true },
  });

  if (!row) {
    throw new ServiceError("not_found", "Invoice request not found.");
  }

  return view(row);
}
