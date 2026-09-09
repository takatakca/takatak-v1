import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import {
  getInstagramAppId,
  getInstagramGraphApiVersion,
  getInstagramOAuthRedirectUri,
} from "@/lib/social/providers/instagram-oauth";

const TOKEN_HOST = "https://api.instagram.com";
const GRAPH_HOST = "https://graph.instagram.com";
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getInstagramAppSecret(): string {
  const secret =
    trimEnv("INSTAGRAM_APP_SECRET") || trimEnv("META_APP_SECRET");
  if (!secret) {
    throw new ServiceError(
      "unavailable",
      "Instagram authorization is not configured.",
      { status: 503 },
    );
  }
  return secret;
}

export class InstagramTokenConsumedError extends Error {
  readonly retryable = false;
  constructor(message: string) {
    super(message);
    this.name = "InstagramTokenConsumedError";
  }
}

export type InstagramTokenExchangeResult = {
  accessToken: string;
  tokenType: string | null;
  expiresAt: Date | null;
  scopes: string[];
  externalSubjectId: string;
  displayName: string | null;
  handle: string | null;
  profileImageUrl: string | null;
};

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function unwrapTokenRecord(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const data = body.data;
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    return data[0] as Record<string, unknown>;
  }
  return body;
}

async function fetchJson(
  url: string,
  init: RequestInit,
  stage: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TOKEN_REQUEST_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceError(
        "unavailable",
        "Instagram authorization timed out. You can retry.",
        { status: 503 },
      );
    }
    throw new ServiceError(
      "unavailable",
      "Instagram authorization could not be completed. You can retry.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ServiceError(
      "unavailable",
      "Instagram returned an unexpected authorization response.",
      { status: 502 },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ServiceError(
      "unavailable",
      "Instagram returned an invalid authorization response.",
      { status: 502 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ServiceError(
      "unavailable",
      "Instagram returned an incomplete authorization response.",
      { status: 502 },
    );
  }

  const record = body as Record<string, unknown>;

  if (!response.ok || record.error) {
    const error =
      typeof record.error === "object" && record.error !== null
        ? (record.error as Record<string, unknown>)
        : null;
    const message = readString(error ?? {}, "message") ?? "";
    const code = typeof error?.code === "number" ? error.code : null;

    logSocialOAuthEvent("instagram-token", {
      stage,
      outcome: "failed",
      provider: "instagram",
    });

    if (
      code === 100 ||
      (message.toLowerCase().includes("code") &&
        message.toLowerCase().includes("expired"))
    ) {
      throw new InstagramTokenConsumedError(
        "Instagram authorization code is no longer valid. Reconnect again.",
      );
    }

    throw new ServiceError(
      "unavailable",
      "Instagram authorization failed temporarily. You can retry.",
      { status: 503 },
    );
  }

  return record;
}

export function mapInstagramIdentityFromRecord(
  raw: Record<string, unknown>,
): {
  externalSubjectId: string;
  handle: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
} | null {
  const id = readString(raw, "user_id") || readString(raw, "id");
  if (!id) return null;
  const handle = readString(raw, "username");
  const name = readString(raw, "name");
  return {
    externalSubjectId: id,
    handle,
    displayName: name || handle,
    profileImageUrl: readString(raw, "profile_picture_url"),
  };
}

export async function exchangeInstagramCodeForStoredCredential(options: {
  code: string;
}): Promise<InstagramTokenExchangeResult> {
  const code = options.code.replace(/#_+$/, "").trim();
  if (!code) {
    throw new ServiceError(
      "invalid_input",
      "Instagram authorization did not return a usable code.",
    );
  }

  const form = new URLSearchParams();
  form.set("client_id", getInstagramAppId());
  form.set("client_secret", getInstagramAppSecret());
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", getInstagramOAuthRedirectUri());
  form.set("code", code);

  const shortLived = unwrapTokenRecord(
    await fetchJson(
      `${TOKEN_HOST}/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
      "short_lived",
    ),
  );

  const shortToken = readString(shortLived, "access_token");
  if (!shortToken) {
    throw new ServiceError(
      "unavailable",
      "Instagram did not return an access token.",
      { status: 502 },
    );
  }

  let accessToken = shortToken;
  let expiresAt: Date | null = null;

  try {
    const longLivedUrl = new URL(`${GRAPH_HOST}/access_token`);
    longLivedUrl.searchParams.set("grant_type", "ig_exchange_token");
    longLivedUrl.searchParams.set("client_secret", getInstagramAppSecret());
    longLivedUrl.searchParams.set("access_token", shortToken);

    const longLived = await fetchJson(
      longLivedUrl.toString(),
      { method: "GET" },
      "long_lived",
    );
    accessToken = readString(longLived, "access_token") || shortToken;
    const expiresIn = longLived.expires_in;
    if (typeof expiresIn === "number" && expiresIn > 0) {
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    }
  } catch {
    // Short-lived token still usable for this session.
  }

  const meUrl = new URL(
    `${GRAPH_HOST}/${getInstagramGraphApiVersion()}/me`,
  );
  meUrl.searchParams.set(
    "fields",
    "user_id,id,username,name,profile_picture_url,account_type",
  );
  meUrl.searchParams.set("access_token", accessToken);

  const me = await fetchJson(meUrl.toString(), { method: "GET" }, "me");
  const identity = mapInstagramIdentityFromRecord(me);
  if (!identity) {
    throw new ServiceError(
      "unavailable",
      "Instagram did not return a usable professional account.",
      { status: 502 },
    );
  }

  const permissions = readString(shortLived, "permissions");
  const scopes = permissions
    ? permissions.split(/[,\s]+/).filter(Boolean)
    : ["instagram_business_basic"];

  return {
    accessToken,
    tokenType: readString(shortLived, "token_type") || "bearer",
    expiresAt,
    scopes,
    externalSubjectId: identity.externalSubjectId,
    displayName: identity.displayName,
    handle: identity.handle,
    profileImageUrl: identity.profileImageUrl,
  };
}
