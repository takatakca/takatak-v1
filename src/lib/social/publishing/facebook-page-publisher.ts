// Facebook Page publishing adapter (Meta Graph API).
//
// Publishes exactly one Page feed post or one photo post with a Page access
// token, verifies the created object, and can reconcile an ambiguous attempt
// by searching the Page feed. The Page token is sent in the POST body or the
// Authorization header, never in a URL, and is never logged.

import { getMetaGraphApiVersion } from "@/lib/social/providers/meta-oauth";
import {
  canonicalCaption,
  type PublicationErrorCategory,
} from "@/lib/social/publishing/publication-model";

const GRAPH_HOST = "https://graph.facebook.com";
const REQUEST_TIMEOUT_MS = 20_000;
const FEED_RECONCILE_LIMIT = 25;

export type FacebookTransportResponse = {
  status: number;
  body: unknown;
};

export type FacebookPublishTransport = (request: {
  method: "GET" | "POST";
  url: URL;
  headers: Record<string, string>;
  form?: URLSearchParams;
  timeoutMs: number;
}) => Promise<FacebookTransportResponse>;

export type FacebookPublishInput = {
  pageId: string;
  pageAccessToken: string;
  message: string;
  link?: string | null;
  /** One publicly reachable image URL. Creates a photo post instead of a feed post. */
  photoUrl?: string | null;
};

export type FacebookPublishResult =
  | { ok: true; remotePostId: string; permalinkUrl: string | null; verified: boolean }
  | {
      ok: false;
      category: PublicationErrorCategory;
      retryable: boolean;
      /** Safe for operators; never contains tokens. */
      message: string;
      /** True when the request may have reached Meta (timeout / unknown network state). */
      ambiguous: boolean;
    };

export type FacebookReconcileResult =
  | { found: true; remotePostId: string; permalinkUrl: string | null; createdAt: string }
  | { found: false }
  | { found: "unknown"; category: PublicationErrorCategory; message: string };

const SAFE_URL = /^https:\/\/[^\s]{1,2000}$/;

function graphUrl(path: string): URL {
  const version = getMetaGraphApiVersion();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${GRAPH_HOST}/${version}${normalized}`);
}

export const defaultFacebookPublishTransport: FacebookPublishTransport = async (request) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.form,
      redirect: "error",
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
};

function readGraphError(body: unknown): {
  code: number | null;
  subcode: number | null;
  type: string | null;
  message: string | null;
} {
  const error =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).error
      : null;
  const record =
    error && typeof error === "object" && !Array.isArray(error)
      ? (error as Record<string, unknown>)
      : {};
  return {
    code: typeof record.code === "number" ? record.code : null,
    subcode: typeof record.error_subcode === "number" ? record.error_subcode : null,
    type: typeof record.type === "string" ? record.type : null,
    message: typeof record.message === "string" ? record.message.slice(0, 300) : null,
  };
}

/**
 * Classify a Graph API failure. Meta error codes (Graph API error reference):
 * 190 invalid/expired token, 10 / 200-299 permission, 4 / 17 / 32 / 613 rate
 * limits, 1 / 2 temporary, 100 invalid parameter, 368 blocked content.
 */
export function classifyFacebookPublishFailure(
  status: number,
  body: unknown,
): { category: PublicationErrorCategory; retryable: boolean; message: string } {
  const error = readGraphError(body);
  const code = error.code;
  const message = error.message ?? `Facebook returned HTTP ${status}.`;
  if (code === 190 || status === 401) {
    return { category: "authorization_expired", retryable: false, message };
  }
  if (code === 10 || (code !== null && code >= 200 && code <= 299) || status === 403) {
    return { category: "permission_denied", retryable: false, message };
  }
  if (code === 4 || code === 17 || code === 32 || code === 613 || status === 429) {
    return { category: "rate_limited", retryable: true, message };
  }
  if (code === 1 || code === 2 || status >= 500) {
    return { category: "provider_unavailable", retryable: true, message };
  }
  if (code === 100 || code === 368 || status === 400) {
    return { category: "invalid_content", retryable: false, message };
  }
  return { category: "unknown", retryable: false, message };
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Create one Page post. Returns the remote post id and, when the follow-up
 * read succeeds, the permalink. A thrown transport error after the request was
 * sent is reported as `ambiguous` so the worker reconciles before retrying.
 */
export async function publishFacebookPagePost(
  input: FacebookPublishInput,
  transport: FacebookPublishTransport = defaultFacebookPublishTransport,
): Promise<FacebookPublishResult> {
  const message = canonicalCaption(input.message);
  if (!input.pageId.trim() || !input.pageAccessToken.trim()) {
    return { ok: false, category: "not_configured", retryable: false, message: "The Page credential is missing.", ambiguous: false };
  }
  if (!message) {
    return { ok: false, category: "invalid_content", retryable: false, message: "The caption is empty.", ambiguous: false };
  }
  if (input.link && !SAFE_URL.test(input.link)) {
    return { ok: false, category: "invalid_content", retryable: false, message: "The link must be an https URL.", ambiguous: false };
  }
  if (input.photoUrl && !SAFE_URL.test(input.photoUrl)) {
    return { ok: false, category: "invalid_content", retryable: false, message: "The photo must be a public https URL.", ambiguous: false };
  }

  const form = new URLSearchParams();
  form.set("access_token", input.pageAccessToken);
  let url: URL;
  if (input.photoUrl) {
    url = graphUrl(`/${encodeURIComponent(input.pageId)}/photos`);
    form.set("url", input.photoUrl);
    form.set("caption", message);
    form.set("published", "true");
  } else {
    url = graphUrl(`/${encodeURIComponent(input.pageId)}/feed`);
    form.set("message", message);
    if (input.link) form.set("link", input.link);
  }

  let response: FacebookTransportResponse;
  try {
    response = await transport({
      method: "POST",
      url,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      form,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      category: aborted ? "timeout" : "provider_unavailable",
      retryable: true,
      message: aborted ? "Facebook did not answer in time." : "Facebook could not be reached.",
      ambiguous: true,
    };
  }

  if (response.status < 200 || response.status >= 300) {
    const failure = classifyFacebookPublishFailure(response.status, response.body);
    return { ok: false, ...failure, ambiguous: false };
  }

  const body =
    response.body && typeof response.body === "object" && !Array.isArray(response.body)
      ? (response.body as Record<string, unknown>)
      : {};
  // Photo posts return { id: <photo id>, post_id: <page_post id> }.
  const remotePostId = readString(body, "post_id") ?? readString(body, "id");
  if (!remotePostId) {
    return { ok: false, category: "unknown", retryable: false, message: "Facebook accepted the request without a post id.", ambiguous: true };
  }

  const verification = await verifyFacebookPagePost(
    { remotePostId, pageAccessToken: input.pageAccessToken },
    transport,
  );
  return {
    ok: true,
    remotePostId,
    permalinkUrl: verification.ok ? verification.permalinkUrl : null,
    verified: verification.ok,
  };
}

/** Read the created post back. A failed read never undoes a successful create. */
export async function verifyFacebookPagePost(
  input: { remotePostId: string; pageAccessToken: string },
  transport: FacebookPublishTransport = defaultFacebookPublishTransport,
): Promise<{ ok: true; permalinkUrl: string | null; createdAt: string | null } | { ok: false }> {
  try {
    const url = graphUrl(`/${encodeURIComponent(input.remotePostId)}`);
    url.searchParams.set("fields", "id,created_time,permalink_url,is_published");
    const response = await transport({
      method: "GET",
      url,
      headers: { authorization: `Bearer ${input.pageAccessToken}` },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (response.status < 200 || response.status >= 300) return { ok: false };
    const body =
      response.body && typeof response.body === "object" && !Array.isArray(response.body)
        ? (response.body as Record<string, unknown>)
        : {};
    if (readString(body, "id") !== input.remotePostId) return { ok: false };
    return {
      ok: true,
      permalinkUrl: readString(body, "permalink_url"),
      createdAt: readString(body, "created_time"),
    };
  } catch {
    return { ok: false };
  }
}

/**
 * After an ambiguous attempt, look for a Page post with the same message
 * created since `since`. Used before any retry so a timeout never duplicates.
 */
export async function reconcileFacebookPagePost(
  input: { pageId: string; pageAccessToken: string; message: string; since: Date },
  transport: FacebookPublishTransport = defaultFacebookPublishTransport,
): Promise<FacebookReconcileResult> {
  const wanted = canonicalCaption(input.message);
  try {
    const url = graphUrl(`/${encodeURIComponent(input.pageId)}/feed`);
    url.searchParams.set("fields", "id,message,created_time,permalink_url");
    url.searchParams.set("since", String(Math.floor(input.since.getTime() / 1000)));
    url.searchParams.set("limit", String(FEED_RECONCILE_LIMIT));
    const response = await transport({
      method: "GET",
      url,
      headers: { authorization: `Bearer ${input.pageAccessToken}` },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (response.status < 200 || response.status >= 300) {
      const failure = classifyFacebookPublishFailure(response.status, response.body);
      return { found: "unknown", category: failure.category, message: failure.message };
    }
    const body =
      response.body && typeof response.body === "object" && !Array.isArray(response.body)
        ? (response.body as Record<string, unknown>)
        : {};
    const data = Array.isArray(body.data) ? body.data : [];
    for (const item of data) {
      const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
      const id = readString(row, "id");
      const message = typeof row.message === "string" ? canonicalCaption(row.message) : "";
      if (id && message === wanted) {
        return {
          found: true,
          remotePostId: id,
          permalinkUrl: readString(row, "permalink_url"),
          createdAt: readString(row, "created_time") ?? new Date().toISOString(),
        };
      }
    }
    return { found: false };
  } catch {
    return { found: "unknown", category: "provider_unavailable", message: "Facebook could not be reached for reconciliation." };
  }
}
