import "server-only";

// GROUPE TAKATAK Billing — server-to-server Facturations client.
// TAKATAK browser -> TAKATAK route handler -> this client -> Facturations
// /integration/v1/*. Each call mints a fresh 60-second token (fresh jti).
// Never forwards browser-supplied business ids, roles, issuers or audiences.

import type { InvoiceDraftInput } from "@/lib/billing/invoices/draft-input";

import {
  classifyFacturationsFailure,
  parseCapabilities,
  parseCreatedDraft,
  parseDashboard,
  parseDraftPage,
  parseDraftWorkflow,
  readFacturationsEnvelope,
  readFacturationsErrorCode,
  isFacturationsDraftId,
  type FacturationsCapabilities,
  type FacturationsCreatedDraft,
  type FacturationsDashboard,
  type FacturationsDraftPage,
  type FacturationsDraftWorkflow,
  type FacturationsResult,
} from "./contract";
import {
  getFacturationsConfig,
  getFacturationsEnvStatus,
} from "./env";
import {
  createFacturationsServiceToken,
  type FacturationsRole,
} from "./service-token";

export interface FacturationsActor {
  subject: string;
  role: FacturationsRole;
}

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 256_000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;

type RequestOptions = {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  idempotencyKey?: string;
};

function failure<T>(
  kind: Extract<FacturationsResult<T>, { ok: false }>["kind"],
  options: { status?: number | null; code?: string | null; retryable?: boolean } = {},
): FacturationsResult<T> {
  return {
    ok: false,
    kind,
    status: options.status ?? null,
    code: options.code ?? null,
    retryable: options.retryable ?? false,
  };
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function facturationsRequest<T>(
  actor: FacturationsActor,
  options: RequestOptions,
  parse: (data: Record<string, unknown>) => T | null,
): Promise<FacturationsResult<T>> {
  const status = getFacturationsEnvStatus();

  if (!status.enabled) {
    return failure("disabled");
  }

  const config = getFacturationsConfig();

  if (!config) {
    return failure("not_configured");
  }

  let token: string;

  try {
    token = createFacturationsServiceToken({
      secret: config.secret,
      issuer: config.issuer,
      audience: config.audience,
      businessId: config.businessId,
      subject: actor.subject,
      roles: [actor.role],
    });
  } catch {
    return failure("not_configured");
  }

  const url = new URL(options.path, config.origin);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  if (options.method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Timeout or connection failure: the outcome is unknown. Retrying with
    // the same Idempotency-Key cannot create a second draft.
    return failure("network_error", { retryable: true });
  }

  const body = await readBoundedJson(response);

  if (!response.ok) {
    const code = readFacturationsErrorCode(body);
    const classified = classifyFacturationsFailure(response.status, code);

    return failure(classified.kind, {
      status: response.status,
      code,
      retryable: classified.retryable,
    });
  }

  const envelope = readFacturationsEnvelope(body, config.businessId);
  const data = envelope ? parse(envelope.data) : null;

  if (!envelope || data === null) {
    // 2xx with an unexpected body: the draft may exist. Retrying with the
    // same Idempotency-Key returns it instead of creating a duplicate.
    return failure("invalid_response", { status: response.status, retryable: true });
  }

  return { ok: true, requestId: envelope.requestId, data };
}

function pageQuery(page: number, pageSize: number): Record<string, string> {
  const safePage = Number.isSafeInteger(page) && page >= 1 && page <= 1000 ? page : 1;
  const safeSize =
    Number.isSafeInteger(pageSize) && pageSize >= 1 && pageSize <= 50 ? pageSize : 20;

  return { page: String(safePage), pageSize: String(safeSize) };
}

export function getFacturationsCapabilities(
  actor: FacturationsActor,
): Promise<FacturationsResult<FacturationsCapabilities>> {
  return facturationsRequest(
    actor,
    { method: "GET", path: "/integration/v1/capabilities" },
    parseCapabilities,
  );
}

export function getFacturationsDashboard(
  actor: FacturationsActor,
): Promise<FacturationsResult<FacturationsDashboard>> {
  return facturationsRequest(
    actor,
    { method: "GET", path: "/integration/v1/dashboard" },
    parseDashboard,
  );
}

export function listFacturationsDrafts(
  actor: FacturationsActor,
  page = 1,
  pageSize = 20,
): Promise<FacturationsResult<FacturationsDraftPage>> {
  return facturationsRequest(
    actor,
    {
      method: "GET",
      path: "/integration/v1/drafts",
      query: pageQuery(page, pageSize),
    },
    parseDraftPage,
  );
}

export function getFacturationsDraftWorkflow(
  actor: FacturationsActor,
  draftId: string,
): Promise<FacturationsResult<FacturationsDraftWorkflow>> {
  if (!isFacturationsDraftId(draftId)) {
    return Promise.resolve(failure("invalid_request"));
  }

  return facturationsRequest(
    actor,
    {
      method: "GET",
      path: `/integration/v1/drafts/${draftId}/workflow`,
    },
    parseDraftWorkflow,
  );
}

/**
 * OWNER only. Creates a persisted DRAFT in Facturations and nothing else:
 * no issuance, Wave write, email, publication or payment.
 */
export function createFacturationsDraft(
  actor: FacturationsActor,
  draft: InvoiceDraftInput,
  idempotencyKey: string,
): Promise<FacturationsResult<FacturationsCreatedDraft>> {
  if (actor.role !== "OWNER") {
    return Promise.resolve(failure("owner_required"));
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return Promise.resolve(failure("invalid_request"));
  }

  return facturationsRequest(
    actor,
    {
      method: "POST",
      path: "/integration/v1/drafts",
      body: draft,
      idempotencyKey,
    },
    parseCreatedDraft,
  );
}
