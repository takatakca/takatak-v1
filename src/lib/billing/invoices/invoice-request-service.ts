import "server-only";

// GROUPE TAKATAK Billing — ecosystem invoice request queue (server only).
//
// Ecosystem apps (Rentauto, AHMV, Ads, 1LV, …) call enqueueInvoiceRequest()
// from their own server code. A platform OWNER then submits a request, which
// creates a DRAFT in the independent Facturations service. Nothing here
// issues, emails, publishes or charges an invoice.

import { Prisma, type BillingInvoiceRequest } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import {
  createFacturationsDraft,
  type FacturationsActor,
} from "@/lib/integrations/facturations/client";
import { ServiceError } from "@/lib/services/service-error";

import { validateInvoiceDraftInput } from "./draft-input";
import {
  deriveFacturationsIdempotencyKey,
  hashInvoiceDraft,
} from "./idempotency";
import { estimateInvoice, InvoiceAmountTooLargeError } from "./preview";
import {
  INVOICE_REQUEST_STATUSES,
  SUBMISSION_CLAIM_STALE_MS,
  canCancelInvoiceRequest,
  statusAfterSubmissionFailure,
  validateInvoiceRequestCreate,
  type InvoiceRequestCreateInput,
  type InvoiceRequestStatus,
} from "./request-policy";

export interface InvoiceRequestView {
  id: string;
  sourceApp: string;
  sourceReference: string;
  clientId: string | null;
  status: InvoiceRequestStatus;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  currency: "CAD";
  estimatedTotalCents: string;
  facturationsDraftId: string | null;
  facturationsTotalCents: string | null;
  submitAttempts: number;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export type SubmitInvoiceRequestOutcome =
  | { outcome: "submitted"; request: InvoiceRequestView }
  | {
      outcome: "failed";
      request: InvoiceRequestView;
      code: string;
      retryable: boolean;
    };

const AUDIT_ENTITY = "billing_invoice_request";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requirePrisma() {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError("unavailable", "Billing storage is unavailable.");
  }

  return prisma;
}

function readDraftSummary(draft: Prisma.JsonValue): {
  customerName: string;
  invoiceDate: string;
  dueDate: string;
} {
  const record =
    draft && typeof draft === "object" && !Array.isArray(draft)
      ? (draft as Record<string, unknown>)
      : {};
  const customer =
    record.customer && typeof record.customer === "object"
      ? (record.customer as Record<string, unknown>)
      : {};

  return {
    customerName: typeof customer.name === "string" ? customer.name : "",
    invoiceDate: typeof record.invoiceDate === "string" ? record.invoiceDate : "",
    dueDate: typeof record.dueDate === "string" ? record.dueDate : "",
  };
}

export function toInvoiceRequestView(row: BillingInvoiceRequest): InvoiceRequestView {
  return {
    id: row.id,
    sourceApp: row.sourceApp,
    sourceReference: row.sourceReference,
    clientId: row.clientId,
    status: row.status,
    ...readDraftSummary(row.draft),
    currency: "CAD",
    estimatedTotalCents: row.estimatedTotalCents.toString(),
    facturationsDraftId: row.facturationsDraftId,
    facturationsTotalCents: row.facturationsTotalCents?.toString() ?? null,
    submitAttempts: row.submitAttempts,
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
  };
}

function isKnownRequestError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

/**
 * Feeds one invoice request into the central queue. Idempotent per
 * (sourceApp, sourceReference): the same draft returns the existing request,
 * a different draft for the same reference is a conflict.
 */
export async function enqueueInvoiceRequest(
  input: InvoiceRequestCreateInput & { masterIdentityId?: string | null },
  actor: { profileId: string | null },
): Promise<{ request: InvoiceRequestView; created: boolean }> {
  // Server-side callers in other verticals are re-validated here: the queue
  // only ever stores drafts Facturations will accept.
  const validation = validateInvoiceRequestCreate({
    sourceApp: input.sourceApp,
    sourceReference: input.sourceReference,
    clientId: input.clientId,
    draft: input.draft,
  });

  if (!validation.success) {
    throw new ServiceError("invalid_input", validation.message, {
      fieldErrors: validation.fieldErrors,
    });
  }

  const masterIdentityId = input.masterIdentityId ?? null;

  if (masterIdentityId !== null && !UUID_PATTERN.test(masterIdentityId)) {
    throw new ServiceError("invalid_input", "The linked identity is invalid.", {
      fieldErrors: { masterIdentityId: "Identity must be a valid id." },
    });
  }

  const request = validation.data;
  const prisma = requirePrisma();
  const draftHash = hashInvoiceDraft(request.draft);
  let estimatedTotalCents: number;

  try {
    estimatedTotalCents = estimateInvoice(request.draft).totalCents;
  } catch (error) {
    if (error instanceof InvoiceAmountTooLargeError) {
      throw new ServiceError("invalid_input", error.message, {
        fieldErrors: { "draft.lines": error.message },
      });
    }

    throw error;
  }

  try {
    const row = await prisma.$transaction(async (transaction) => {
      const created = await transaction.billingInvoiceRequest.create({
        data: {
          sourceApp: request.sourceApp,
          sourceReference: request.sourceReference,
          clientId: request.clientId,
          masterIdentityId,
          idempotencyKey: deriveFacturationsIdempotencyKey(
            request.sourceApp,
            request.sourceReference,
          ),
          draft: request.draft as unknown as Prisma.InputJsonValue,
          draftHash,
          currency: "CAD",
          estimatedTotalCents: BigInt(estimatedTotalCents),
          createdByProfileId: actor.profileId,
        },
      });

      await transaction.auditLog.create({
        data: {
          profileId: actor.profileId,
          clientId: request.clientId,
          action: "billing.invoice_request.created",
          entityType: AUDIT_ENTITY,
          entityId: created.id,
          metadata: { sourceApp: request.sourceApp },
        },
      });

      return created;
    });

    return { request: toInvoiceRequestView(row), created: true };
  } catch (error) {
    if (isKnownRequestError(error, "P2003")) {
      throw new ServiceError("invalid_input", "The linked client or identity does not exist.", {
        fieldErrors: { clientId: "Unknown client or identity." },
      });
    }

    if (!isKnownRequestError(error, "P2002")) {
      throw error;
    }

    const existing = await prisma.billingInvoiceRequest.findUnique({
      where: {
        sourceApp_sourceReference: {
          sourceApp: request.sourceApp,
          sourceReference: request.sourceReference,
        },
      },
    });

    if (existing && existing.draftHash === draftHash) {
      return { request: toInvoiceRequestView(existing), created: false };
    }

    throw new ServiceError(
      "conflict",
      "This source reference already has a different invoice request. Use a new reference for a correction.",
    );
  }
}

export async function listInvoiceRequests(
  options: { status?: InvoiceRequestStatus; take?: number } = {},
): Promise<InvoiceRequestView[]> {
  const prisma = requirePrisma();
  const take =
    Number.isSafeInteger(options.take) && options.take! > 0 && options.take! <= 100
      ? options.take!
      : 50;
  const status =
    options.status && INVOICE_REQUEST_STATUSES.includes(options.status)
      ? options.status
      : undefined;

  const rows = await prisma.billingInvoiceRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.map(toInvoiceRequestView);
}

export async function countInvoiceRequestsByStatus(): Promise<
  Record<InvoiceRequestStatus, number>
> {
  const prisma = requirePrisma();
  const groups = await prisma.billingInvoiceRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts = Object.fromEntries(
    INVOICE_REQUEST_STATUSES.map((status) => [status, 0]),
  ) as Record<InvoiceRequestStatus, number>;

  for (const group of groups) {
    counts[group.status] = group._count._all;
  }

  return counts;
}

async function claimForSubmission(
  id: string,
  profileId: string,
): Promise<BillingInvoiceRequest> {
  const prisma = requirePrisma();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - SUBMISSION_CLAIM_STALE_MS);

  // Compare-and-set claim: only one concurrent submit can win.
  const claimed = await prisma.billingInvoiceRequest.updateMany({
    where: {
      id,
      OR: [
        { status: { in: ["pending", "failed"] } },
        { status: "submitting", updatedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: "submitting",
      submitAttempts: { increment: 1 },
      lastAttemptAt: now,
      submittedByProfileId: profileId,
    },
  });

  const row = await prisma.billingInvoiceRequest.findUnique({ where: { id } });

  if (!row) {
    throw new ServiceError("not_found", "Invoice request not found.");
  }

  if (claimed.count === 0) {
    throw new ServiceError(
      "conflict",
      row.status === "submitting"
        ? "This invoice request is already being sent."
        : `This invoice request cannot be sent while ${row.status}.`,
    );
  }

  return row;
}

/**
 * Sends one queued request to Facturations as a DRAFT. Requires the
 * Facturations OWNER identity. Retrying after a timeout is safe: the
 * Idempotency-Key is deterministic, so Facturations returns the same draft.
 */
export async function submitInvoiceRequest(
  id: string,
  context: { profileId: string; actor: FacturationsActor },
): Promise<SubmitInvoiceRequestOutcome> {
  if (context.actor.role !== "OWNER") {
    throw new ServiceError(
      "forbidden",
      "Only the TAKATAK platform owner can send invoice requests to Facturations.",
    );
  }

  const prisma = requirePrisma();
  const row = await claimForSubmission(id, context.profileId);
  const draft = validateInvoiceDraftInput(row.draft);

  if (!draft.success || hashInvoiceDraft(draft.data) !== row.draftHash) {
    const rejected = await prisma.billingInvoiceRequest.update({
      where: { id },
      data: { status: "rejected", lastErrorCode: "STORED_DRAFT_INVALID" },
    });

    return {
      outcome: "failed",
      request: toInvoiceRequestView(rejected),
      code: "STORED_DRAFT_INVALID",
      retryable: false,
    };
  }

  const result = await createFacturationsDraft(
    context.actor,
    draft.data,
    row.idempotencyKey,
  );

  if (result.ok) {
    const submitted = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.billingInvoiceRequest.update({
        where: { id },
        data: {
          status: "submitted",
          facturationsDraftId: result.data.id,
          facturationsTotalCents: BigInt(result.data.totals.totalCents),
          submittedAt: new Date(),
          lastErrorCode: null,
        },
      });

      await transaction.auditLog.create({
        data: {
          profileId: context.profileId,
          clientId: updated.clientId,
          action: "billing.invoice_request.submitted",
          entityType: AUDIT_ENTITY,
          entityId: id,
          metadata: {
            sourceApp: updated.sourceApp,
            facturationsDraftId: result.data.id,
            totalsMatch:
              updated.estimatedTotalCents === BigInt(result.data.totals.totalCents),
          },
        },
      });

      return updated;
    });

    return { outcome: "submitted", request: toInvoiceRequestView(submitted) };
  }

  const code = result.code ?? result.kind.toUpperCase();
  const status = statusAfterSubmissionFailure(result);
  const failed = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.billingInvoiceRequest.update({
      where: { id },
      data: { status, lastErrorCode: code },
    });

    await transaction.auditLog.create({
      data: {
        profileId: context.profileId,
        clientId: updated.clientId,
        action: "billing.invoice_request.submit_failed",
        entityType: AUDIT_ENTITY,
        entityId: id,
        metadata: { sourceApp: updated.sourceApp, code, status },
      },
    });

    return updated;
  });

  return {
    outcome: "failed",
    request: toInvoiceRequestView(failed),
    code,
    retryable: result.retryable,
  };
}

export async function cancelInvoiceRequest(
  id: string,
  profileId: string,
): Promise<InvoiceRequestView> {
  const prisma = requirePrisma();
  const cancellable = INVOICE_REQUEST_STATUSES.filter(canCancelInvoiceRequest);

  return prisma.$transaction(async (transaction) => {
    const result = await transaction.billingInvoiceRequest.updateMany({
      where: { id, status: { in: cancellable } },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    const row = await transaction.billingInvoiceRequest.findUnique({ where: { id } });

    if (!row) {
      throw new ServiceError("not_found", "Invoice request not found.");
    }

    if (result.count === 0) {
      throw new ServiceError(
        "conflict",
        `This invoice request cannot be cancelled while ${row.status}.`,
      );
    }

    await transaction.auditLog.create({
      data: {
        profileId,
        clientId: row.clientId,
        action: "billing.invoice_request.cancelled",
        entityType: AUDIT_ENTITY,
        entityId: id,
        metadata: { sourceApp: row.sourceApp },
      },
    });

    return toInvoiceRequestView(row);
  });
}
