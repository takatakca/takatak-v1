// Bluesky publishing adapter (AT Protocol XRPC through the account's PDS).
//
// Creates exactly one `app.bsky.feed.post` record with
// `com.atproto.repo.createRecord`, reads it back with
// `com.atproto.repo.getRecord`, and can reconcile an ambiguous attempt by
// scanning the author feed. The adapter never sees a token: the transport is
// built from an authenticated OAuth session whose DPoP-bound access token is
// attached by the SDK. Requests carry only the XRPC method, query and JSON
// body, so nothing secret can land in a URL or a log line.

import {
  BLUESKY_POST_GRAPHEME_LIMIT,
  blueskyTextWithinLimits,
  composeBlueskyPostText,
  type PublicationErrorCategory,
} from "@/lib/social/publishing/publication-model";

export const BLUESKY_POST_COLLECTION = "app.bsky.feed.post";
const REQUEST_TIMEOUT_MS = 20_000;
const FEED_RECONCILE_LIMIT = 25;
const SAFE_URL = /^https:\/\/[^\s]{1,2000}$/;

export type BlueskyTransportResponse = {
  status: number;
  body: unknown;
};

/** One XRPC call. `nsid` is the method (e.g. com.atproto.repo.createRecord). */
export type BlueskyTransportRequest = {
  method: "GET" | "POST";
  nsid: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  timeoutMs: number;
};

export type BlueskyPublishTransport = (request: BlueskyTransportRequest) => Promise<BlueskyTransportResponse>;

/** The authenticated fetch of an `OAuthSession` (`session.fetchHandler`). */
export type BlueskySessionFetch = (pathname: string, init?: RequestInit) => Promise<Response>;

export type BlueskyPublishInput = {
  /** The account's DID (SocialAccount.externalAccountId). */
  did: string;
  text: string;
  link?: string | null;
  /** Record creation time; defaults to now. */
  createdAt?: Date;
  /** BCP-47 language tags for the post. */
  langs?: string[];
};

export type BlueskyPublishResult =
  | { ok: true; remotePostId: string; cid: string | null; permalinkUrl: string | null; verified: boolean }
  | {
      ok: false;
      category: PublicationErrorCategory;
      retryable: boolean;
      /** Safe for operators; never contains tokens. */
      message: string;
      /** True when the request may have reached the PDS (timeout / unknown network state). */
      ambiguous: boolean;
    };

export type BlueskyReconcileResult =
  | { found: true; remotePostId: string; permalinkUrl: string | null; createdAt: string }
  | { found: false }
  | { found: "unknown"; category: PublicationErrorCategory; message: string };

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Parse `at://did/collection/rkey`. */
export function parseBlueskyPostUri(uri: string): { did: string; collection: string; rkey: string } | null {
  const match = /^at:\/\/(did:[a-z0-9:%._-]+)\/([a-zA-Z0-9.-]+)\/([a-zA-Z0-9._~:-]{1,512})$/.exec(uri.trim());
  if (!match) return null;
  return { did: match[1], collection: match[2], rkey: match[3] };
}

/** Public web URL of a post, from its record URI. */
export function blueskyPermalink(uri: string): string | null {
  const parsed = parseBlueskyPostUri(uri);
  if (!parsed || parsed.collection !== BLUESKY_POST_COLLECTION) return null;
  return `https://bsky.app/profile/${encodeURIComponent(parsed.did)}/post/${encodeURIComponent(parsed.rkey)}`;
}

/**
 * Build the transport from an authenticated session fetch. The SDK adds the
 * DPoP proof and access token itself; this layer only shapes XRPC calls.
 * `isAuthorizationError` lets the caller map SDK token errors (refresh failed,
 * revoked, invalid) to an HTTP 401 so they are classified, not treated as
 * ambiguous network failures.
 */
export function createBlueskySessionTransport(
  fetchHandler: BlueskySessionFetch,
  options: { isAuthorizationError?: (error: unknown) => boolean } = {},
): BlueskyPublishTransport {
  return async (request) => {
    const params = new URLSearchParams(request.query ?? {});
    const pathname = `/xrpc/${request.nsid}${params.size ? `?${params.toString()}` : ""}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await fetchHandler(pathname, {
        method: request.method,
        headers: {
          accept: "application/json",
          ...(request.body ? { "content-type": "application/json" } : {}),
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
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
    } catch (error) {
      if (options.isAuthorizationError?.(error)) {
        return { status: 401, body: { error: "AuthorizationExpired", message: "The Bluesky session could not be refreshed." } };
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * Classify an XRPC failure. Error names follow the AT Protocol conventions
 * (`error` field of the JSON body): ExpiredToken / InvalidToken /
 * AuthenticationRequired, InsufficientPermissions / Forbidden,
 * RateLimitExceeded, UpstreamFailure / InternalServerError, InvalidRequest /
 * InvalidRecord / BlobTooLarge.
 */
export function classifyBlueskyPublishFailure(
  status: number,
  body: unknown,
): { category: PublicationErrorCategory; retryable: boolean; message: string } {
  const source = record(body);
  const name = readString(source, "error") ?? "";
  const detail = readString(source, "message");
  const message = (detail ?? name ?? `Bluesky returned HTTP ${status}.`).slice(0, 300);
  if (status === 401 || /^(ExpiredToken|InvalidToken|AuthenticationRequired|AuthorizationExpired|AuthMissing)$/.test(name)) {
    return { category: "authorization_expired", retryable: false, message };
  }
  if (status === 403 || /^(InsufficientPermissions|Forbidden|InvalidDpopProof|AccountDeactivated|AccountTakedown)$/.test(name)) {
    return { category: "permission_denied", retryable: false, message };
  }
  if (status === 429 || name === "RateLimitExceeded") {
    return { category: "rate_limited", retryable: true, message };
  }
  if (status >= 500 || /^(UpstreamFailure|InternalServerError|UpstreamTimeout|NotEnoughResources)$/.test(name)) {
    return { category: "provider_unavailable", retryable: true, message };
  }
  if (status === 400 || /^(InvalidRequest|InvalidRecord|BlobTooLarge|InvalidSwap|RecordTooLarge)$/.test(name)) {
    return { category: "invalid_content", retryable: false, message };
  }
  return { category: "unknown", retryable: false, message };
}

type Facet = {
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: "app.bsky.richtext.facet#link"; uri: string }>;
};

/** Link facets for every https URL in the text (byte offsets, as the lexicon requires). */
export function buildBlueskyLinkFacets(text: string): Facet[] {
  const encoder = new TextEncoder();
  const facets: Facet[] = [];
  const pattern = /https:\/\/[^\s<>"')\]]+/g;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    // Trailing punctuation is not part of the link.
    const uri = raw.replace(/[.,;:!?]+$/, "");
    if (!SAFE_URL.test(uri) || match.index === undefined) continue;
    const byteStart = encoder.encode(text.slice(0, match.index)).length;
    const byteEnd = byteStart + encoder.encode(uri).length;
    facets.push({ index: { byteStart, byteEnd }, features: [{ $type: "app.bsky.richtext.facet#link", uri }] });
  }
  return facets;
}

/**
 * Create one post record. Returns the record URI as the remote post id and,
 * when the follow-up read succeeds, marks it verified. A thrown transport
 * error after the request was sent is reported as `ambiguous` so the worker
 * reconciles before retrying.
 */
export async function publishBlueskyPost(
  input: BlueskyPublishInput,
  transport: BlueskyPublishTransport,
): Promise<BlueskyPublishResult> {
  const did = input.did.trim();
  if (!did.startsWith("did:")) {
    return { ok: false, category: "not_configured", retryable: false, message: "The Bluesky account identity is missing.", ambiguous: false };
  }
  if (input.link && !SAFE_URL.test(input.link)) {
    return { ok: false, category: "invalid_content", retryable: false, message: "The link must be an https URL.", ambiguous: false };
  }
  const text = composeBlueskyPostText({ caption: input.text, link: input.link });
  if (!text) {
    return { ok: false, category: "invalid_content", retryable: false, message: "The caption is empty.", ambiguous: false };
  }
  if (!blueskyTextWithinLimits(text)) {
    return {
      ok: false,
      category: "invalid_content",
      retryable: false,
      message: `Bluesky posts are limited to ${BLUESKY_POST_GRAPHEME_LIMIT} characters.`,
      ambiguous: false,
    };
  }

  const facets = buildBlueskyLinkFacets(text);
  const postRecord: Record<string, unknown> = {
    $type: BLUESKY_POST_COLLECTION,
    text,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    ...(facets.length ? { facets } : {}),
    ...(input.langs?.length ? { langs: input.langs.slice(0, 3) } : {}),
  };

  let response: BlueskyTransportResponse;
  try {
    response = await transport({
      method: "POST",
      nsid: "com.atproto.repo.createRecord",
      body: { repo: did, collection: BLUESKY_POST_COLLECTION, record: postRecord },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      category: aborted ? "timeout" : "provider_unavailable",
      retryable: true,
      message: aborted ? "Bluesky did not answer in time." : "Bluesky could not be reached.",
      ambiguous: true,
    };
  }

  if (response.status < 200 || response.status >= 300) {
    const failure = classifyBlueskyPublishFailure(response.status, response.body);
    return { ok: false, ...failure, ambiguous: false };
  }

  const body = record(response.body);
  const uri = readString(body, "uri");
  const parsed = uri ? parseBlueskyPostUri(uri) : null;
  if (!uri || !parsed || parsed.did !== did || parsed.collection !== BLUESKY_POST_COLLECTION) {
    return { ok: false, category: "unknown", retryable: false, message: "Bluesky accepted the request without a record URI.", ambiguous: true };
  }

  const verification = await verifyBlueskyPost({ remotePostId: uri }, transport);
  return {
    ok: true,
    remotePostId: uri,
    cid: readString(body, "cid"),
    permalinkUrl: blueskyPermalink(uri),
    verified: verification.ok,
  };
}

/** Read the created record back. A failed read never undoes a successful create. */
export async function verifyBlueskyPost(
  input: { remotePostId: string },
  transport: BlueskyPublishTransport,
): Promise<{ ok: true; cid: string | null; createdAt: string | null } | { ok: false }> {
  const parsed = parseBlueskyPostUri(input.remotePostId);
  if (!parsed) return { ok: false };
  try {
    const response = await transport({
      method: "GET",
      nsid: "com.atproto.repo.getRecord",
      query: { repo: parsed.did, collection: parsed.collection, rkey: parsed.rkey },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (response.status < 200 || response.status >= 300) return { ok: false };
    const body = record(response.body);
    if (readString(body, "uri") !== input.remotePostId) return { ok: false };
    return { ok: true, cid: readString(body, "cid"), createdAt: readString(record(body.value), "createdAt") };
  } catch {
    return { ok: false };
  }
}

/**
 * After an ambiguous attempt, look for an own post with the same text created
 * since `since`. Reposts and replies are ignored. Used before any retry so a
 * timeout never duplicates.
 */
export async function reconcileBlueskyPost(
  input: { did: string; text: string; link?: string | null; since: Date },
  transport: BlueskyPublishTransport,
): Promise<BlueskyReconcileResult> {
  const wanted = composeBlueskyPostText({ caption: input.text, link: input.link });
  try {
    const response = await transport({
      method: "GET",
      nsid: "app.bsky.feed.getAuthorFeed",
      query: { actor: input.did, limit: String(FEED_RECONCILE_LIMIT), filter: "posts_no_replies" },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (response.status < 200 || response.status >= 300) {
      const failure = classifyBlueskyPublishFailure(response.status, response.body);
      return { found: "unknown", category: failure.category, message: failure.message };
    }
    const feed = Array.isArray(record(response.body).feed) ? (record(response.body).feed as unknown[]) : [];
    for (const item of feed) {
      const row = record(item);
      if (row.reason) continue; // repost
      const post = record(row.post);
      const uri = readString(post, "uri");
      const author = readString(record(post.author), "did");
      const value = record(post.record);
      const text = typeof value.text === "string" ? composeBlueskyPostText({ caption: value.text }) : "";
      const createdAt = readString(value, "createdAt") ?? readString(post, "indexedAt");
      if (!uri || author !== input.did || text !== wanted) continue;
      if (createdAt && Date.parse(createdAt) < input.since.getTime()) continue;
      return { found: true, remotePostId: uri, permalinkUrl: blueskyPermalink(uri), createdAt: createdAt ?? new Date().toISOString() };
    }
    return { found: false };
  } catch {
    return { found: "unknown", category: "provider_unavailable", message: "Bluesky could not be reached for reconciliation." };
  }
}
