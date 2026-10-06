// GROUPE TAKATAK Billing — invoice request lifecycle policy.
// Pure module. Mirrors the BillingInvoiceRequestStatus enum.
//
//   pending ──submit──▶ submitting ──ok──▶ submitted   (Facturations DRAFT exists)
//      ▲                    │
//      │                    ├─retryable failure──▶ failed ──submit──▶ submitting
//      │                    └─final failure──────▶ rejected
//   cancel: pending | failed | rejected ──▶ cancelled
//
// "submitted" means a Facturations DRAFT exists. It is NOT issued, sent or paid.

import type { FacturationsFailureKind } from "@/lib/integrations/facturations/contract";

import type { InvoiceDraftInput } from "./draft-input";
import { validateInvoiceDraftInput } from "./draft-input";
import { isBillingSourceApp, isSourceReference, type BillingSourceApp } from "./source-apps";
import type { FieldErrors, ValidationResult } from "@/lib/validation/common";

export const INVOICE_REQUEST_STATUSES = [
  "pending",
  "submitting",
  "submitted",
  "failed",
  "rejected",
  "cancelled",
] as const;

export type InvoiceRequestStatus = (typeof INVOICE_REQUEST_STATUSES)[number];

/** A "submitting" claim older than this is considered abandoned (crash/timeout). */
export const SUBMISSION_CLAIM_STALE_MS = 2 * 60 * 1000;

export const INVOICE_REQUEST_STATUS_LABELS: Record<InvoiceRequestStatus, string> = {
  pending: "Pending review",
  submitting: "Sending to Facturations",
  submitted: "Draft created in Facturations",
  failed: "Failed — safe to retry",
  rejected: "Rejected by Facturations — needs correction",
  cancelled: "Cancelled",
};

export function canSubmitInvoiceRequest(
  status: InvoiceRequestStatus,
  updatedAt: Date,
  now: Date = new Date(),
): boolean {
  if (status === "pending" || status === "failed") {
    return true;
  }

  return (
    status === "submitting" &&
    now.getTime() - updatedAt.getTime() > SUBMISSION_CLAIM_STALE_MS
  );
}

export function canCancelInvoiceRequest(status: InvoiceRequestStatus): boolean {
  return status === "pending" || status === "failed" || status === "rejected";
}

export function statusAfterSubmissionFailure(input: {
  kind: FacturationsFailureKind;
  retryable: boolean;
}): Extract<InvoiceRequestStatus, "pending" | "failed" | "rejected"> {
  // Configuration, identity or activation problems say nothing about the
  // invoice itself: keep the request pending until the setup is fixed.
  if (
    input.kind === "disabled" ||
    input.kind === "not_configured" ||
    input.kind === "identity_unavailable" ||
    input.kind === "auth_rejected" ||
    input.kind === "owner_required" ||
    input.kind === "not_found"
  ) {
    return "pending";
  }

  // Only Facturations' own verdict on the invoice data is final.
  if (input.kind === "invalid_request" || input.kind === "idempotency_conflict") {
    return "rejected";
  }

  return "failed";
}

export interface InvoiceRequestCreateInput {
  sourceApp: BillingSourceApp;
  sourceReference: string;
  clientId: string | null;
  draft: InvoiceDraftInput;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_KEYS = ["sourceApp", "sourceReference", "clientId", "draft"];

export function validateInvoiceRequestCreate(
  payload: unknown,
  options: { allowedSourceApps?: readonly BillingSourceApp[] } = {},
): ValidationResult<InvoiceRequestCreateInput> {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    !Object.keys(payload).every((key) => REQUEST_KEYS.includes(key))
  ) {
    return {
      success: false,
      message: "The invoice request is invalid.",
      fieldErrors: { request: "Unexpected or missing request fields." },
    };
  }

  const source = payload as Record<string, unknown>;
  const errors: FieldErrors = {};

  const sourceApp = isBillingSourceApp(source.sourceApp) ? source.sourceApp : null;

  if (!sourceApp || (options.allowedSourceApps && !options.allowedSourceApps.includes(sourceApp))) {
    errors.sourceApp = "This source application cannot feed invoice requests here.";
  }

  if (!isSourceReference(source.sourceReference)) {
    errors.sourceReference = "Use 1–200 characters: letters, digits, . _ : / -";
  }

  let clientId: string | null = null;

  if (source.clientId !== undefined && source.clientId !== null) {
    if (typeof source.clientId === "string" && UUID_PATTERN.test(source.clientId)) {
      clientId = source.clientId.toLowerCase();
    } else {
      errors.clientId = "Client must be a valid id.";
    }
  }

  const draft = validateInvoiceDraftInput(source.draft);

  if (!draft.success) {
    for (const [key, message] of Object.entries(draft.fieldErrors)) {
      errors[`draft.${key}`] = message;
    }
  }

  if (Object.keys(errors).length > 0 || !draft.success || !sourceApp) {
    return {
      success: false,
      message: "Correct the highlighted invoice request fields.",
      fieldErrors: errors,
    };
  }

  return {
    success: true,
    data: {
      sourceApp,
      sourceReference: source.sourceReference as string,
      clientId,
      draft: draft.data,
    },
  };
}
