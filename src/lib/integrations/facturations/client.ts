// Server-to-server reader for the Facturations /integration/v1 API.
//
// - Fixed path allowlist; the origin comes from server configuration only.
// - Fresh 60-second signed token per request (never reused, never logged).
// - No redirects, no cookies, bounded time and body size.
// - Responses are re-validated field by field; anything unexpected fails
//   closed instead of being displayed.

import type { FacturationsConfig } from "./config";
import type { FacturationsPrincipal } from "./access";
import { createFacturationsServiceToken } from "./token";

export const FACTURATIONS_TIMEOUT_MS = 8_000;
export const FACTURATIONS_MAX_RESPONSE_BYTES = 256_000;
export const FACTURATIONS_MAX_PAGE_SIZE = 50;

export type FacturationsErrorCode =
  | "rejected"
  | "integration_disabled"
  | "invalid_request"
  | "unavailable"
  | "invalid_response";

export class FacturationsClientError extends Error {
  constructor(public readonly code: FacturationsErrorCode) {
    super(`Facturations request failed: ${code}`);
    this.name = "FacturationsClientError";
  }
}

export interface FacturationsDraftSummary {
  status: "DRAFTS_ONLY";
  currency: "CAD";
  draftCount: number;
  draftTotalCents: number;
  customerCount: number;
}

export interface FacturationsDraftRow {
  id: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  totalCents: number;
  currency: "CAD";
  status: "DRAFT";
}

export interface FacturationsDraftPage {
  page: number;
  pageSize: number;
  drafts: FacturationsDraftRow[];
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface FacturationsClientOptions {
  config: Pick<FacturationsConfig, "origin" | "secret" | "issuer" | "audience">;
  principal: FacturationsPrincipal;
  fetchImpl?: FetchLike;
  nowMs?: () => number;
  timeoutMs?: number;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UNSIGNED_RE = /^\d{1,15}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unsignedCount(value: unknown): number {
  if (typeof value === "string" && UNSIGNED_RE.test(value)) {
    return Number(value);
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  throw new FacturationsClientError("invalid_response");
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function errorForStatus(status: number): FacturationsErrorCode {
  if (status === 401 || status === 403) return "rejected";
  if (status === 404) return "integration_disabled";
  if (status === 400 || status === 422) return "invalid_request";
  return "unavailable";
}

export function parseEnvelope(
  json: unknown,
  businessId: string,
): Record<string, unknown> {
  if (
    !isObject(json) ||
    json.version !== 1 ||
    json.businessId !== businessId ||
    !isObject(json.data)
  ) {
    throw new FacturationsClientError("invalid_response");
  }
  return json.data;
}

export function parseDraftSummary(data: Record<string, unknown>): FacturationsDraftSummary {
  if (
    data.status !== "DRAFTS_ONLY" ||
    data.currency !== "CAD" ||
    data.issuedInvoicesAvailable !== false ||
    data.paymentsAvailable !== false ||
    data.revenueAvailable !== false
  ) {
    throw new FacturationsClientError("invalid_response");
  }
  return {
    status: "DRAFTS_ONLY",
    currency: "CAD",
    draftCount: unsignedCount(data.draftCount),
    draftTotalCents: unsignedCount(data.draftTotalCents),
    customerCount: unsignedCount(data.customerCount),
  };
}

export function parseDraftPage(data: Record<string, unknown>): FacturationsDraftPage {
  const { page, pageSize, drafts } = data;
  if (
    data.status !== "DRAFTS_ONLY" ||
    !Number.isSafeInteger(page) || (page as number) < 1 ||
    !Number.isSafeInteger(pageSize) || (pageSize as number) < 1 ||
    (pageSize as number) > FACTURATIONS_MAX_PAGE_SIZE ||
    !Array.isArray(drafts) || drafts.length > (pageSize as number)
  ) {
    throw new FacturationsClientError("invalid_response");
  }

  const rows = drafts.map((draft): FacturationsDraftRow => {
    if (
      !isObject(draft) ||
      typeof draft.id !== "string" || !UUID_RE.test(draft.id) ||
      typeof draft.customerName !== "string" ||
      draft.customerName.length > 200 ||
      !isCalendarDate(draft.invoiceDate) ||
      !isCalendarDate(draft.dueDate) ||
      draft.currency !== "CAD" ||
      draft.status !== "DRAFT"
    ) {
      throw new FacturationsClientError("invalid_response");
    }
    return {
      id: draft.id,
      customerName: draft.customerName,
      invoiceDate: draft.invoiceDate,
      dueDate: draft.dueDate,
      totalCents: unsignedCount(draft.totalCents),
      currency: "CAD",
      status: "DRAFT",
    };
  });

  return { page: page as number, pageSize: pageSize as number, drafts: rows };
}

export function createFacturationsClient(options: FacturationsClientOptions) {
  const fetchImpl: FetchLike = options.fetchImpl ?? fetch;
  const now = options.nowMs ?? Date.now;
  const timeoutMs = options.timeoutMs ?? FACTURATIONS_TIMEOUT_MS;
  const { config, principal } = options;

  async function getJson(pathWithQuery: string): Promise<Record<string, unknown>> {
    const token = createFacturationsServiceToken({
      secret: config.secret,
      issuer: config.issuer,
      audience: config.audience,
      subject: principal.subject,
      businessId: principal.businessId,
      roles: principal.roles,
      nowMs: now(),
    });

    let response: Response;
    try {
      response = await fetchImpl(`${config.origin}${pathWithQuery}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new FacturationsClientError("unavailable");
    }

    if (!response.ok) {
      throw new FacturationsClientError(errorForStatus(response.status));
    }

    const declared = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > FACTURATIONS_MAX_RESPONSE_BYTES) {
      throw new FacturationsClientError("invalid_response");
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new FacturationsClientError("unavailable");
    }
    if (Buffer.byteLength(text, "utf8") > FACTURATIONS_MAX_RESPONSE_BYTES) {
      throw new FacturationsClientError("invalid_response");
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new FacturationsClientError("invalid_response");
    }
    return parseEnvelope(json, principal.businessId);
  }

  return {
    async getDraftSummary(): Promise<FacturationsDraftSummary> {
      return parseDraftSummary(await getJson("/integration/v1/dashboard"));
    },

    async listDrafts(page = 1, pageSize = 20): Promise<FacturationsDraftPage> {
      if (
        !Number.isSafeInteger(page) || page < 1 || page > 10_000 ||
        !Number.isSafeInteger(pageSize) || pageSize < 1 ||
        pageSize > FACTURATIONS_MAX_PAGE_SIZE
      ) {
        throw new FacturationsClientError("invalid_request");
      }
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      return parseDraftPage(await getJson(`/integration/v1/drafts?${query}`));
    },
  };
}
