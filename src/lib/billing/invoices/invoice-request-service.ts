import "server-only";

// GROUPE TAKATAK Billing — ecosystem invoice request queue (server only).
//
// Ecosystem apps (Rentauto, AHMV, Ads, 1LV, …) call enqueueInvoiceRequest()
// from their own server code. A platform OWNER then submits a request, which
// creates a DRAFT in the independent Facturations service. Nothing here
// issues, emails, publishes or charges an invoice.

import { randomUUID } from "node:crypto";

import { Prisma, type BillingInvoiceRequest } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import {
  createFacturationsDraft,
  getFacturationsDraft,
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
  canReconcileInvoiceRequest,
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

  // The id is generated here so the Facturations Idempotency-Key can be
  // derived from it: unique per request row and per TAKATAK install.
  const id = randomUUID();

  try {
    const row = await prisma.$transaction(async (transaction) => {
      const created = await transaction.billingInvoiceRequest.create({
        data: {
          id,
          sourceApp: request.sourceApp,
          sourceReference: request.sourceReference,
          clientId: request.clientId,
          masterIdentityId,
          idempotencyKey: deriveFacturationsIdempotencyKey(id),
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

    if (
      existing &&
      existing.draftHash === draftHash &&
      existing.clientId === request.clientId &&
      existing.masterIdentityId === masterIdentityId
    ) {
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

type FinalWrite =
  | { written: true; row: BillingInvoiceRequest }
  | { written: false; row: BillingInvoiceRequest };

/**
 * Writes the outcome of one submission attempt only if that attempt still
 * owns the claim (same status + attempt counter). A superseded attempt never
 * overwrites a newer attempt's result.
 */
async function writeAttemptOutcome(
  claimed: BillingInvoiceRequest,
  data: Prisma.BillingInvoiceRequestUpdateManyMutationInput,
  audit: { profileId: string; action: string; metadata: Prisma.InputJsonObject },
): Promise<FinalWrite> {
  const prisma = requirePrisma();

  return prisma.$transaction(async (transaction) => {
    const result = await transaction.billingInvoiceRequest.updateMany({
      where: {
        id: claimed.id,
        status: "submitting",
        submitAttempts: claimed.submitAttempts,
      },
      data,
    });
    const row = await transaction.billingInvoiceRequest.findUniqueOrThrow({
      where: { id: claimed.id },
    });

    if (result.count === 0) {
      return { written: false, row };
    }

    await transaction.auditLog.create({
      data: {
        profileId: audit.profileId,
        clientId: row.clientId,
        action: audit.action,
        entityType: AUDIT_ENTITY,
        entityId: row.id,
        metadata: { sourceApp: row.sourceApp, ...audit.metadata },
      },
    });

    return { written: true, row };
  });
}

function failedOutcome(
  row: BillingInvoiceRequest,
  code: string,
  retryable: boolean,
): SubmitInvoiceRequestOutcome {
  return { outcome: "failed", request: toInvoiceRequestView(row), code, retryable };
}

/**
 * Sends one queued request to Facturations as a DRAFT. Requires the
 * Facturations OWNER identity. Retrying after a timeout is safe: the
 * request's Idempotency-Key never changes, so Facturations returns the same
 * draft instead of creating a second one.
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

  const row = await claimForSubmission(id, context.profileId);
  const draft = validateInvoiceDraftInput(row.draft);

  if (!draft.success || hashInvoiceDraft(draft.data) !== row.draftHash) {
    const written = await writeAttemptOutcome(
      row,
      { status: "rejected", lastErrorCode: "STORED_DRAFT_INVALID" },
      {
        profileId: context.profileId,
        action: "billing.invoice_request.submit_failed",
        metadata: { code: "STORED_DRAFT_INVALID", status: "rejected" },
      },
    );

    return failedOutcome(written.row, "STORED_DRAFT_INVALID", false);
  }

  const result = await createFacturationsDraft(
    context.actor,
    draft.data,
    row.idempotencyKey,
  );

  if (result.ok) {
    let written: FinalWrite;

    try {
      written = await writeAttemptOutcome(
        row,
        {
          status: "submitted",
          facturationsDraftId: result.data.id,
          facturationsTotalCents: BigInt(result.data.totals.totalCents),
          submittedAt: new Date(),
          lastErrorCode: null,
        },
        {
          profileId: context.profileId,
          action: "billing.invoice_request.submitted",
          metadata: {
            facturationsDraftId: result.data.id,
            totalsMatch: row.estimatedTotalCents === BigInt(result.data.totals.totalCents),
          },
        },
      );
    } catch (error) {
      if (!isKnownRequestError(error, "P2002")) {
        throw error;
      }

      // This Facturations draft id is already linked to another request:
      // never link it twice. An owner must reconcile.
      const conflict = await writeAttemptOutcome(
        row,
        { status: "needs_reconciliation", lastErrorCode: "DRAFT_ALREADY_LINKED" },
        {
          profileId: context.profileId,
          action: "billing.invoice_request.submit_failed",
          metadata: { code: "DRAFT_ALREADY_LINKED", status: "needs_reconciliation" },
        },
      );

      return failedOutcome(conflict.row, "DRAFT_ALREADY_LINKED", false);
    }

    if (
      written.written ||
      (written.row.status === "submitted" &&
        written.row.facturationsDraftId === result.data.id)
    ) {
      return { outcome: "submitted", request: toInvoiceRequestView(written.row) };
    }

    throw new ServiceError(
      "conflict",
      "This attempt was superseded by a newer one. Refresh to see the current status.",
    );
  }

  const code = result.code ?? result.kind.toUpperCase();
  const status = statusAfterSubmissionFailure(result);
  const written = await writeAttemptOutcome(
    row,
    { status, lastErrorCode: code },
    {
      profileId: context.profileId,
      action: "billing.invoice_request.submit_failed",
      metadata: { code, status },
    },
  );

  return failedOutcome(written.row, code, result.retryable && status === "failed");
}

/**
 * Cancels a request only while no Facturations draft can exist for it:
 * never attempted, or rejected by Facturations validation before creation.
 */
export async function cancelInvoiceRequest(
  id: string,
  profileId: string,
): Promise<InvoiceRequestView> {
  const prisma = requirePrisma();

  return prisma.$transaction(async (transaction) => {
    const result = await transaction.billingInvoiceRequest.updateMany({
      where: {
        id,
        OR: [{ status: "pending", submitAttempts: 0 }, { status: "rejected" }],
      },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    const row = await transaction.billingInvoiceRequest.findUnique({ where: { id } });

    if (!row) {
      throw new ServiceError("not_found", "Invoice request not found.");
    }

    if (result.count === 0) {
      throw new ServiceError(
        "conflict",
        row.status === "pending" || row.status === "failed"
          ? "This request was already sent at least once, so a Facturations draft may exist. Send it again (safe) instead of cancelling."
          : `This invoice request cannot be cancelled while ${row.status}.`,
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

function storedCustomerEmail(draft: Prisma.JsonValue): string {
  const record =
    draft && typeof draft === "object" && !Array.isArray(draft)
      ? (draft as Record<string, unknown>)
      : {};
  const customer =
    record.customer && typeof record.customer === "object"
      ? (record.customer as Record<string, unknown>)
      : {};

  return typeof customer.email === "string" ? customer.email.trim().toLowerCase() : "";
}

/**
 * OWNER links an existing Facturations draft to a request whose key was
 * already used (409). The draft is fetched from Facturations and must match
 * the stored request exactly (customer email, dates, recalculated total).
 */
export async function reconcileInvoiceRequest(
  id: string,
  facturationsDraftId: string,
  context: { profileId: string; actor: FacturationsActor },
): Promise<InvoiceRequestView> {
  if (context.actor.role !== "OWNER") {
    throw new ServiceError("forbidden", "Only the TAKATAK platform owner can link Facturations drafts.");
  }

  const prisma = requirePrisma();
  const row = await prisma.billingInvoiceRequest.findUnique({ where: { id } });

  if (!row) {
    throw new ServiceError("not_found", "Invoice request not found.");
  }

  if (!canReconcileInvoiceRequest(row.status)) {
    throw new ServiceError("conflict", `This invoice request cannot be linked while ${row.status}.`);
  }

  const remote = await getFacturationsDraft(context.actor, facturationsDraftId);

  if (!remote.ok) {
    throw new ServiceError(
      remote.kind === "not_found" || remote.kind === "invalid_request" ? "not_found" : "unavailable",
      "The Facturations draft could not be loaded.",
    );
  }

  const summary = readDraftSummary(row.draft);
  const matches =
    BigInt(remote.data.totals.totalCents) === row.estimatedTotalCents &&
    remote.data.customerEmail.trim().toLowerCase() === storedCustomerEmail(row.draft) &&
    remote.data.invoiceDate === summary.invoiceDate &&
    remote.data.dueDate === summary.dueDate;

  if (!matches) {
    throw new ServiceError(
      "conflict",
      "That Facturations draft does not match this request (customer, dates or total).",
    );
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const result = await transaction.billingInvoiceRequest.updateMany({
        where: { id, status: row.status },
        data: {
          status: "submitted",
          facturationsDraftId: remote.data.id,
          facturationsTotalCents: BigInt(remote.data.totals.totalCents),
          submittedAt: new Date(),
          submittedByProfileId: context.profileId,
          lastErrorCode: null,
        },
      });

      if (result.count === 0) {
        throw new ServiceError("conflict", "The request changed meanwhile. Refresh and try again.");
      }

      await transaction.auditLog.create({
        data: {
          profileId: context.profileId,
          clientId: row.clientId,
          action: "billing.invoice_request.reconciled",
          entityType: AUDIT_ENTITY,
          entityId: id,
          metadata: { sourceApp: row.sourceApp, facturationsDraftId: remote.data.id },
        },
      });

      return toInvoiceRequestView(
        await transaction.billingInvoiceRequest.findUniqueOrThrow({ where: { id } }),
      );
    });
  } catch (error) {
    if (isKnownRequestError(error, "P2002")) {
      throw new ServiceError("conflict", "That Facturations draft is already linked to another request.");
    }

    throw error;
  }
}
