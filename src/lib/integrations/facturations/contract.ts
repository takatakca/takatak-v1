// GROUPE TAKATAK Billing — Facturations integration v1 response contract.
// Pure module. Every Facturations response is re-validated here before it is
// shown in TAKATAK; unknown or mismatched payloads fail closed.
//
// Facturations only exposes DRAFT and INTERNAL APPROVAL state through v1.
// Never relabel these values as issued, sent, paid, revenue or receivables.

export type FacturationsFailureKind =
  | "disabled"
  | "not_configured"
  | "identity_unavailable"
  | "auth_rejected"
  | "token_replay"
  | "owner_required"
  | "not_found"
  | "invalid_request"
  | "idempotency_conflict"
  | "unavailable"
  | "invalid_response"
  | "network_error";

export type FacturationsResult<T> =
  | { ok: true; requestId: string | null; data: T }
  | {
      ok: false;
      kind: FacturationsFailureKind;
      status: number | null;
      code: string | null;
      /** True when an identical retry (same Idempotency-Key) is safe. */
      retryable: boolean;
    };

export interface FacturationsCapabilities {
  integrationVersion: 1;
  capabilities: {
    capabilitiesRead: boolean;
    dashboardRead: boolean;
    draftsRead: boolean;
    draftDetailsRead: boolean;
    customersRead: boolean;
    approvalsRead: boolean;
    draftWrite: boolean;
    ownerApprovalWrite: boolean;
    issuanceAuthorizationWrite: boolean;
    deliveryAuthorizationWrite: boolean;
    portalPublicationWrite: boolean;
  };
}

export interface FacturationsDashboard {
  status: "DRAFTS_ONLY";
  currency: "CAD";
  draftCount: string;
  draftTotalCents: string;
  customerCount: string;
}

export interface FacturationsDraftSummary {
  id: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  totalCents: string;
  currency: "CAD";
  status: "DRAFT";
}

export interface FacturationsDraftPage {
  page: number;
  pageSize: number;
  drafts: FacturationsDraftSummary[];
}

export interface FacturationsPreviewTotals {
  currency: "CAD";
  subtotalCents: number;
  taxableSubtotalCents: number;
  taxTotalCents: number;
  totalCents: number;
}

export interface FacturationsCreatedDraft {
  id: string;
  status: "DRAFT";
  totals: FacturationsPreviewTotals;
}

export interface FacturationsDraftDetail {
  id: string;
  status: "DRAFT";
  customerEmail: string;
  invoiceDate: string;
  dueDate: string;
  totals: FacturationsPreviewTotals;
}

export const FACTURATIONS_FINANCIAL_STATES = [
  "NO_EVIDENCE",
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "OVERPAID",
  "FULLY_REFUNDED",
  "REFUND_EXCEEDS_PAYMENTS",
] as const;

export type FacturationsFinancialState = (typeof FACTURATIONS_FINANCIAL_STATES)[number];
export type FacturationsProofScope = "NONE" | "SYNTHETIC_ONLY" | "VERIFIED_PROVIDER_PRESENT";

export interface FacturationsIssuedInvoice {
  id: string;
  officialInvoiceNumber: string;
  issuedAt: string;
  currency: "CAD";
  totalCents: string;
  balanceCents: string;
  financialState: FacturationsFinancialState;
  proofScope: FacturationsProofScope;
}

export interface FacturationsDraftIssuance {
  draftId: string;
  issued: boolean;
  invoice: FacturationsIssuedInvoice | null;
}

export interface FacturationsDraftWorkflow {
  draftId: string;
  status: "DRAFT";
  internalApproval: "NOT_APPROVED" | "APPROVED_INTERNAL_ONLY";
  nextStep: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSIGNED_INTEGER_STRING = /^[0-9]{1,16}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ERROR_CODE_PATTERN = /^[A-Z0-9_]{2,64}$/;

const CAPABILITY_KEYS = [
  "capabilitiesRead",
  "dashboardRead",
  "draftsRead",
  "draftDetailsRead",
  "customersRead",
  "approvalsRead",
  "draftWrite",
  "ownerApprovalWrite",
  "issuanceAuthorizationWrite",
  "deliveryAuthorizationWrite",
  "portalPublicationWrite",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isUnsignedIntegerString(value: unknown): value is string {
  return typeof value === "string" && UNSIGNED_INTEGER_STRING.test(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function isFacturationsDraftId(value: unknown): value is string {
  return isUuid(value);
}

/**
 * Validates the v1 envelope and that the response belongs to the exact
 * configured business. Returns `data` or null.
 */
export function readFacturationsEnvelope(
  body: unknown,
  expectedBusinessId: string,
): { requestId: string | null; data: Record<string, unknown> } | null {
  if (
    !isRecord(body) ||
    body.version !== 1 ||
    body.businessId !== expectedBusinessId ||
    !isRecord(body.data)
  ) {
    return null;
  }

  const requestId =
    typeof body.requestId === "string" && isUuid(body.requestId)
      ? body.requestId
      : null;

  return { requestId, data: body.data };
}

export function parseCapabilities(
  data: Record<string, unknown>,
): FacturationsCapabilities | null {
  if (
    data.service !== "facturations" ||
    data.integrationVersion !== 1 ||
    !isRecord(data.capabilities)
  ) {
    return null;
  }

  const source = data.capabilities;
  const capabilities = {} as FacturationsCapabilities["capabilities"];

  for (const key of CAPABILITY_KEYS) {
    if (typeof source[key] !== "boolean") {
      return null;
    }

    capabilities[key] = source[key] as boolean;
  }

  return { integrationVersion: 1, capabilities };
}

export function parseDashboard(
  data: Record<string, unknown>,
): FacturationsDashboard | null {
  if (
    data.status !== "DRAFTS_ONLY" ||
    data.currency !== "CAD" ||
    !isUnsignedIntegerString(data.draftCount) ||
    !isUnsignedIntegerString(data.draftTotalCents) ||
    !isUnsignedIntegerString(data.customerCount)
  ) {
    return null;
  }

  return {
    status: "DRAFTS_ONLY",
    currency: "CAD",
    draftCount: data.draftCount,
    draftTotalCents: data.draftTotalCents,
    customerCount: data.customerCount,
  };
}

function parseDraftSummary(value: unknown): FacturationsDraftSummary | null {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    typeof value.customerName !== "string" ||
    typeof value.invoiceDate !== "string" ||
    !DATE_PATTERN.test(value.invoiceDate) ||
    typeof value.dueDate !== "string" ||
    !DATE_PATTERN.test(value.dueDate) ||
    !isUnsignedIntegerString(value.totalCents) ||
    value.currency !== "CAD" ||
    value.status !== "DRAFT"
  ) {
    return null;
  }

  return {
    id: value.id,
    customerName: value.customerName.slice(0, 160),
    invoiceDate: value.invoiceDate,
    dueDate: value.dueDate,
    totalCents: value.totalCents,
    currency: "CAD",
    status: "DRAFT",
  };
}

export function parseDraftPage(
  data: Record<string, unknown>,
): FacturationsDraftPage | null {
  if (
    data.status !== "DRAFTS_ONLY" ||
    !Number.isSafeInteger(data.page) ||
    !Number.isSafeInteger(data.pageSize) ||
    !Array.isArray(data.drafts) ||
    data.drafts.length > 50
  ) {
    return null;
  }

  const drafts: FacturationsDraftSummary[] = [];

  for (const raw of data.drafts) {
    const draft = parseDraftSummary(raw);

    if (!draft) {
      return null;
    }

    drafts.push(draft);
  }

  return {
    page: data.page as number,
    pageSize: data.pageSize as number,
    drafts,
  };
}

export function parsePreviewTotals(
  value: unknown,
): FacturationsPreviewTotals | null {
  if (
    !isRecord(value) ||
    value.currency !== "CAD" ||
    value.waveSynced !== false ||
    value.emailed !== false ||
    !isNonNegativeSafeInteger(value.subtotalCents) ||
    !isNonNegativeSafeInteger(value.taxableSubtotalCents) ||
    !isNonNegativeSafeInteger(value.taxTotalCents) ||
    !isNonNegativeSafeInteger(value.totalCents)
  ) {
    return null;
  }

  return {
    currency: "CAD",
    subtotalCents: value.subtotalCents,
    taxableSubtotalCents: value.taxableSubtotalCents,
    taxTotalCents: value.taxTotalCents,
    totalCents: value.totalCents,
  };
}

export function parseCreatedDraft(
  data: Record<string, unknown>,
): FacturationsCreatedDraft | null {
  if (!isUuid(data.id) || data.status !== "DRAFT") {
    return null;
  }

  const totals = parsePreviewTotals(data.preview);

  if (!totals) {
    return null;
  }

  return { id: data.id, status: "DRAFT", totals };
}

export function parseDraftDetail(
  data: Record<string, unknown>,
): FacturationsDraftDetail | null {
  if (!isUuid(data.id) || data.status !== "DRAFT" || !isRecord(data.preview)) {
    return null;
  }

  const preview = data.preview;
  const totals = parsePreviewTotals(preview);
  const customer = isRecord(preview.customer) ? preview.customer : null;

  if (
    !totals ||
    !customer ||
    typeof customer.email !== "string" ||
    typeof preview.invoiceDate !== "string" ||
    !DATE_PATTERN.test(preview.invoiceDate) ||
    typeof preview.dueDate !== "string" ||
    !DATE_PATTERN.test(preview.dueDate)
  ) {
    return null;
  }

  return {
    id: data.id,
    status: "DRAFT",
    customerEmail: customer.email.slice(0, 254),
    invoiceDate: preview.invoiceDate,
    dueDate: preview.dueDate,
    totals,
  };
}

export function parseDraftIssuance(
  data: Record<string, unknown>,
): FacturationsDraftIssuance | null {
  if (!isUuid(data.draftId) || typeof data.issued !== "boolean") {
    return null;
  }

  if (!data.issued) {
    return data.invoice === null ? { draftId: data.draftId, issued: false, invoice: null } : null;
  }

  const invoice = data.invoice;

  if (
    !isRecord(invoice) ||
    !isUuid(invoice.id) ||
    typeof invoice.officialInvoiceNumber !== "string" ||
    invoice.officialInvoiceNumber.length < 1 ||
    invoice.officialInvoiceNumber.length > 160 ||
    typeof invoice.issuedAt !== "string" ||
    !Number.isFinite(Date.parse(invoice.issuedAt)) ||
    invoice.currency !== "CAD" ||
    !isUnsignedIntegerString(invoice.totalCents) ||
    !isUnsignedIntegerString(invoice.balanceCents) ||
    !(FACTURATIONS_FINANCIAL_STATES as readonly unknown[]).includes(invoice.financialState) ||
    !["NONE", "SYNTHETIC_ONLY", "VERIFIED_PROVIDER_PRESENT"].includes(invoice.proofScope as string)
  ) {
    return null;
  }

  return {
    draftId: data.draftId,
    issued: true,
    invoice: {
      id: invoice.id,
      officialInvoiceNumber: invoice.officialInvoiceNumber,
      issuedAt: new Date(invoice.issuedAt).toISOString(),
      currency: "CAD",
      totalCents: invoice.totalCents,
      balanceCents: invoice.balanceCents,
      financialState: invoice.financialState as FacturationsFinancialState,
      proofScope: invoice.proofScope as FacturationsProofScope,
    },
  };
}

export function parseDraftWorkflow(
  data: Record<string, unknown>,
): FacturationsDraftWorkflow | null {
  if (
    !isUuid(data.draftId) ||
    data.status !== "DRAFT" ||
    (data.internalApproval !== "NOT_APPROVED" &&
      data.internalApproval !== "APPROVED_INTERNAL_ONLY") ||
    typeof data.nextStep !== "string" ||
    !/^[A-Z_]{2,64}$/.test(data.nextStep)
  ) {
    return null;
  }

  return {
    draftId: data.draftId,
    status: "DRAFT",
    internalApproval: data.internalApproval,
    nextStep: data.nextStep,
  };
}

/** Extracts a safe Facturations error code from an error body. */
export function readFacturationsErrorCode(body: unknown): string | null {
  if (
    isRecord(body) &&
    typeof body.error === "string" &&
    ERROR_CODE_PATTERN.test(body.error)
  ) {
    return body.error;
  }

  return null;
}

/**
 * Maps a Facturations HTTP failure into a TAKATAK failure kind.
 * Retry policy: 5xx, 401 replay and network errors are safe to retry with the
 * same Idempotency-Key and a fresh token. 4xx validation results are final.
 */
export function classifyFacturationsFailure(
  status: number,
  code: string | null,
): { kind: FacturationsFailureKind; retryable: boolean } {
  if (status === 401 && code === "INTEGRATION_TOKEN_REPLAY") {
    return { kind: "token_replay", retryable: true };
  }

  if (status === 401) {
    return { kind: "auth_rejected", retryable: false };
  }

  if (status === 403) {
    return { kind: "owner_required", retryable: false };
  }

  if (status === 404) {
    return { kind: "not_found", retryable: false };
  }

  if (status === 409) {
    return { kind: "idempotency_conflict", retryable: false };
  }

  if (status === 400 || status === 413 || status === 415 || status === 422) {
    return { kind: "invalid_request", retryable: false };
  }

  if (status >= 500) {
    return { kind: "unavailable", retryable: true };
  }

  // Unknown outcome (e.g. 429): an identical idempotent retry is safe.
  return { kind: "invalid_response", retryable: true };
}
