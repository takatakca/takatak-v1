import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import {
  getMetaAppId,
  getMetaGraphApiVersion,
  getMetaOAuthRedirectUri,
  META_OAUTH_INSTAGRAM_SCOPES,
  META_OAUTH_PAGE_SCOPES,
} from "@/lib/social/providers/meta-oauth";

const META_GRAPH_HOST = "https://graph.facebook.com";
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;
const TOKEN_EXCHANGE_MAX_ATTEMPTS = 4;
const TOKEN_EXCHANGE_BACKOFF_BASE_MS = 400;

export type MetaTokenExchangeResult = {
  accessToken: string;
  tokenType: string | null;
  expiresAt: Date | null;
  scopes: string[];
  externalSubjectId: string;
  displayName: string | null;
};

export class MetaTokenTransientError extends Error {
  readonly retryable = true;
  constructor(message: string) {
    super(message);
    this.name = "MetaTokenTransientError";
  }
}

export class MetaTokenConsumedError extends Error {
  readonly retryable = false;
  constructor(message: string) {
    super(message);
    this.name = "MetaTokenConsumedError";
  }
}

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function isTransientNetworkCause(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = `${error.name} ${error.message}`.toLowerCase();
  const cause =
    error.cause instanceof Error
      ? `${error.cause.name} ${error.cause.message}`.toLowerCase()
      : "";
  const haystack = `${message} ${cause}`;
  return (
    haystack.includes("und_err_socket") ||
    haystack.includes("other side closed") ||
    haystack.includes("econnreset") ||
    haystack.includes("econnrefused") ||
    haystack.includes("etimedout") ||
    haystack.includes("epipe") ||
    haystack.includes("socket") ||
    haystack.includes("network") ||
    haystack.includes("fetch failed") ||
    error.name === "AbortError"
  );
}

function computeTokenExchangeBackoffMs(attempt: number): number {
  const exp = Math.max(0, attempt - 1);
  const raw = TOKEN_EXCHANGE_BACKOFF_BASE_MS * 2 ** exp;
  const jitter = Math.floor(raw * 0.15 * ((attempt % 3) - 1));
  return Math.min(5_000, Math.max(TOKEN_EXCHANGE_BACKOFF_BASE_MS, raw + jitter));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function getMetaAppSecret(): string {
  const secret = trimEnv("META_APP_SECRET");

  if (!secret) {
    throw new ServiceError(
      "unavailable",
      "Facebook authorization is not configured.",
      { status: 503 },
    );
  }

  return secret;
}

function graphUrl(path: string): URL {
  const version = getMetaGraphApiVersion();
  const url = new URL(
    `${META_GRAPH_HOST}/${version}${path}`,
  );

  if (url.origin !== META_GRAPH_HOST) {
    throw new ServiceError(
      "unavailable",
      "The Facebook Graph host is invalid.",
      { status: 503 },
    );
  }

  return url;
}

async function fetchMetaJsonOnce(
  url: URL,
  stage: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TOKEN_REQUEST_TIMEOUT_MS,
  );

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (isTransientNetworkCause(error)) {
      throw new MetaTokenTransientError(
        "Facebook could not be reached during token exchange.",
      );
    }

    throw new ServiceError(
      "unavailable",
      "Facebook token exchange could not be completed.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    if (response.status >= 500 || response.status === 429) {
      throw new MetaTokenTransientError(
        "Facebook returned a temporary token-exchange failure.",
      );
    }
    throw new ServiceError(
      "unavailable",
      "Facebook returned an unexpected token response.",
      { status: 503 },
    );
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new MetaTokenTransientError(
      "Facebook returned an incomplete token response.",
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    throw new MetaTokenTransientError(
      "Facebook returned an incomplete token response.",
    );
  }

  const record = body as Record<string, unknown>;
  const errorObj =
    typeof record.error === "object" &&
    record.error !== null &&
    !Array.isArray(record.error)
      ? (record.error as Record<string, unknown>)
      : null;
  const code =
    typeof errorObj?.code === "number" ? errorObj.code : null;
  const message =
    typeof errorObj?.message === "string" ? errorObj.message : "";

  if (!response.ok || errorObj) {
    console.info(
      "[meta-token]",
      JSON.stringify({
        stage,
        outcome: "provider_error",
        at: new Date().toISOString(),
      }),
    );

    if (
      stage === "exchange_code" &&
      (code === 100 ||
        code === 190 ||
        /code (has )?been used|authorization code.*expired|invalid.*code/i.test(
          message,
        ))
    ) {
      throw new MetaTokenConsumedError(
        "Facebook authorization code is no longer valid. Reconnect again.",
      );
    }

    if (
      response.status >= 500 ||
      response.status === 429 ||
      response.status === 408 ||
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504
    ) {
      throw new MetaTokenTransientError(
        "Facebook returned a temporary token-exchange failure.",
      );
    }

    throw new ServiceError(
      "unavailable",
      "Facebook rejected the authorization code exchange.",
      { status: 503 },
    );
  }

  return record;
}

async function fetchMetaJson(
  url: URL,
  stage: string,
): Promise<Record<string, unknown>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= TOKEN_EXCHANGE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchMetaJsonOnce(url, stage);
    } catch (error) {
      lastError = error;
      if (!(error instanceof MetaTokenTransientError)) {
        throw error;
      }
      if (attempt >= TOKEN_EXCHANGE_MAX_ATTEMPTS) {
        break;
      }
      await sleep(computeTokenExchangeBackoffMs(attempt));
    }
  }

  if (lastError instanceof MetaTokenTransientError) {
    throw new ServiceError(
      "unavailable",
      "Facebook could not be reached; reconnect again.",
      { status: 503 },
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new ServiceError(
        "unavailable",
        "Facebook token exchange could not be completed.",
        { status: 503 },
      );
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function readExpiresAt(
  record: Record<string, unknown>,
): Date | null {
  const expiresIn = record.expires_in;

  if (
    typeof expiresIn === "number" &&
    Number.isFinite(expiresIn) &&
    expiresIn > 0
  ) {
    return new Date(Date.now() + expiresIn * 1000);
  }

  return null;
}

/**
 * Exchange the authorization code for a short-lived user access token.
 * Uses the exact redirect URI from trusted server config + PKCE verifier.
 */
export async function exchangeMetaAuthorizationCode(options: {
  code: string;
  codeVerifier: string;
}): Promise<{
  accessToken: string;
  tokenType: string | null;
  expiresAt: Date | null;
}> {
  if (!options.code.trim() || !options.codeVerifier.trim()) {
    throw new ServiceError(
      "invalid_input",
      "The Facebook authorization response is incomplete.",
    );
  }

  const url = graphUrl("/oauth/access_token");
  url.searchParams.set("client_id", getMetaAppId());
  url.searchParams.set(
    "redirect_uri",
    getMetaOAuthRedirectUri(),
  );
  url.searchParams.set(
    "client_secret",
    getMetaAppSecret(),
  );
  url.searchParams.set("code", options.code);
  url.searchParams.set(
    "code_verifier",
    options.codeVerifier,
  );

  const record = await fetchMetaJson(
    url,
    "exchange_code",
  );

  const accessToken = readString(record, "access_token");

  if (!accessToken) {
    throw new ServiceError(
      "unavailable",
      "Facebook did not return an access token.",
      { status: 503 },
    );
  }

  const tokenType = readString(record, "token_type");

  return {
    accessToken,
    tokenType,
    expiresAt: readExpiresAt(record),
  };
}

/**
 * Prefer Meta long-lived user token when available.
 * Falls back to the short-lived token if exchange fails.
 */
export async function exchangeMetaLongLivedUserToken(options: {
  shortLivedToken: string;
}): Promise<{
  accessToken: string;
  tokenType: string | null;
  expiresAt: Date | null;
  usedLongLived: boolean;
}> {
  const url = graphUrl("/oauth/access_token");
  url.searchParams.set(
    "grant_type",
    "fb_exchange_token",
  );
  url.searchParams.set("client_id", getMetaAppId());
  url.searchParams.set(
    "client_secret",
    getMetaAppSecret(),
  );
  url.searchParams.set(
    "fb_exchange_token",
    options.shortLivedToken,
  );

  try {
    const record = await fetchMetaJson(
      url,
      "exchange_long_lived",
    );
    const accessToken = readString(
      record,
      "access_token",
    );

    if (!accessToken) {
      return {
        accessToken: options.shortLivedToken,
        tokenType: null,
        expiresAt: null,
        usedLongLived: false,
      };
    }

    return {
      accessToken,
      tokenType: readString(record, "token_type"),
      expiresAt: readExpiresAt(record),
      usedLongLived: true,
    };
  } catch {
    return {
      accessToken: options.shortLivedToken,
      tokenType: null,
      expiresAt: null,
      usedLongLived: false,
    };
  }
}

export async function fetchMetaAuthorizedUser(options: {
  accessToken: string;
}): Promise<{
  externalSubjectId: string;
  displayName: string | null;
}> {
  const url = graphUrl("/me");
  url.searchParams.set("fields", "id,name");
  url.searchParams.set(
    "access_token",
    options.accessToken,
  );

  const record = await fetchMetaJson(url, "me");
  const externalSubjectId = readString(record, "id");

  if (!externalSubjectId) {
    throw new ServiceError(
      "unavailable",
      "Facebook did not return an authorized user identifier.",
      { status: 503 },
    );
  }

  return {
    externalSubjectId,
    displayName: readString(record, "name"),
  };
}

export async function fetchMetaGrantedPermissions(options: {
  accessToken: string;
}): Promise<string[]> {
  const url = graphUrl("/me/permissions");
  url.searchParams.set(
    "access_token",
    options.accessToken,
  );

  const record = await fetchMetaJson(
    url,
    "permissions",
  );
  const data = record.data;

  if (!Array.isArray(data)) {
    return [];
  }

  const granted: string[] = [];

  for (const entry of data) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry)
    ) {
      continue;
    }

    const row = entry as Record<string, unknown>;
    const permission = readString(row, "permission");
    const status = readString(row, "status");

    if (
      permission &&
      status === "granted"
    ) {
      granted.push(permission);
    }
  }

  return granted;
}

export function assertRequiredMetaPageScopes(
  granted: string[],
): void {
  const grantedSet = new Set(granted);
  const missing = META_OAUTH_PAGE_SCOPES.filter(
    (scope) => !grantedSet.has(scope),
  );

  // public_profile is often implicit; still require Page scopes explicitly.
  const criticalMissing = missing.filter(
    (scope) => scope !== "public_profile",
  );

  if (criticalMissing.length > 0) {
    throw new ServiceError(
      "forbidden",
      "Facebook authorization is missing required Page permissions. Please reconnect and grant Page access.",
    );
  }
}

export function hasRequiredMetaInstagramScopes(
  granted: readonly string[],
): boolean {
  return granted.includes(META_OAUTH_INSTAGRAM_SCOPES[0]);
}

export async function exchangeMetaCodeForStoredCredential(options: {
  code: string;
  codeVerifier: string;
}): Promise<MetaTokenExchangeResult> {
  const shortLived =
    await exchangeMetaAuthorizationCode({
      code: options.code,
      codeVerifier: options.codeVerifier,
    });

  const longLived =
    await exchangeMetaLongLivedUserToken({
      shortLivedToken: shortLived.accessToken,
    });

  const accessToken = longLived.accessToken;
  const tokenType =
    longLived.tokenType ?? shortLived.tokenType;
  const expiresAt =
    longLived.expiresAt ?? shortLived.expiresAt;

  const [user, granted] = await Promise.all([
    fetchMetaAuthorizedUser({ accessToken }),
    fetchMetaGrantedPermissions({ accessToken }),
  ]);

  assertRequiredMetaPageScopes(granted);

  return {
    accessToken,
    tokenType,
    expiresAt,
    scopes: granted,
    externalSubjectId: user.externalSubjectId,
    displayName: user.displayName,
  };
}
