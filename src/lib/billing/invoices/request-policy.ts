// GROUPE TAKATAK Billing — invoice request lifecycle policy.
// Pure module. Mirrors the BillingInvoiceRequestStatus enum.
//
//   pending ──submit──▶ submitting ──ok────────────────▶ submitted (Facturations DRAFT exists)
//      ▲                    ├─ unknown outcome ───────▶ failed ──submit──▶ submitting
//      │                    ├─ config / auth gap ────▶ pending
//      │                    ├─ invalid data (4xx) ───▶ rejected            (no draft was created)
//      │                    └─ 409 key already used ─▶ needs_reconciliation ──link draft──▶ submitted
//   cancel: only while NO draft can exist — pending with 0 attempts, or rejected.
//
// Once any attempt may have reached Facturations, the request can only end
// as "submitted" (same Idempotency-Key retry, or owner-verified link), so a
// draft can never be orphaned and then duplicated by a re-queued request.
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
  "needs_reconciliation",
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
  needs_reconciliation: "Draft may already exist — link it",
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

/**
 * Cancelling is allowed only while no Facturations draft can exist:
 * never attempted, or rejected by Facturations validation before creation.
 */
export function canCancelInvoiceRequest(
  status: InvoiceRequestStatus,
  submitAttempts: number,
): boolean {
  return (status === "pending" && submitAttempts === 0) || status === "rejected";
}

export function canReconcileInvoiceRequest(status: InvoiceRequestStatus): boolean {
  return status === "needs_reconciliation";
}

export function statusAfterSubmissionFailure(input: {
  kind: FacturationsFailureKind;
  retryable: boolean;
}): Extract<InvoiceRequestStatus, "pending" | "failed" | "rejected" | "needs_reconciliation"> {
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

  // Facturations validates the body before touching storage: no draft exists.
  if (input.kind === "invalid_request") {
    return "rejected";
  }

  // The Idempotency-Key is already bound to a stored draft in Facturations.
  if (input.kind === "idempotency_conflict") {
    return "needs_reconciliation";
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
