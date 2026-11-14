// Instagram professional account publishing adapter (Instagram API with
// Instagram Login, graph.instagram.com).
//
// Instagram has no text-only posts: every publication needs exactly one
// publicly reachable HTTPS media URL. Publishing is a two-step container flow:
//   1. POST /{ig-user-id}/media            → { id: <container id> }
//   2. GET  /{container-id}?fields=status_code  until FINISHED (bounded)
//   3. POST /{ig-user-id}/media_publish    → { id: <media id> }
//   4. GET  /{media-id}?fields=id,permalink,timestamp (verification only)
// Only step 3 can create a visible post, so only a step-3 transport failure
// is reported as ambiguous. The user token travels in the POST body or the
// Authorization header, never in a URL, and is never logged.

import { getInstagramGraphApiVersion } from "@/lib/social/providers/instagram-oauth";
import {
  INSTAGRAM_CAPTION_LIMIT,
  canonicalCaption,
  type PublicationErrorCategory,
} from "@/lib/social/publishing/publication-model";

const GRAPH_HOST = "https://graph.instagram.com";
const REQUEST_TIMEOUT_MS = 20_000;
const MEDIA_RECONCILE_LIMIT = 25;
/** Container status polls before giving up (images are usually ready at once). */
export const INSTAGRAM_CONTAINER_MAX_POLLS = 12;
export const INSTAGRAM_CONTAINER_POLL_INTERVAL_MS = 5_000;

export type InstagramTransportResponse = {
  status: number;
  body: unknown;
};

/** Same shape as the Facebook publish transport so one fake serves both. */
export type InstagramPublishTransport = (request: {
  method: "GET" | "POST";
  url: URL;
  headers: Record<string, string>;
  form?: URLSearchParams;
  timeoutMs: number;
}) => Promise<InstagramTransportResponse>;

export type InstagramPublishInput = {
  igUserId: string;
  accessToken: string;
  caption: string;
  /** Exactly one of imageUrl / videoUrl. Public HTTPS URL. */
  imageUrl?: string | null;
  /** Published as a Reel (media_type=REELS). Public HTTPS URL. */
  videoUrl?: string | null;
  /** Bounded status polling; tests inject 0 ms and a small count. */
  maxStatusPolls?: number;
  pollIntervalMs?: number;
};

export type InstagramPublishResult =
  | { ok: true; remotePostId: string; permalinkUrl: string | null; verified: boolean; containerId: string }
  | {
      ok: false;
      category: PublicationErrorCategory;
      retryable: boolean;
      /** Safe for operators; never contains tokens. */
      message: string;
      /** True only when media_publish may have reached Instagram. */
      ambiguous: boolean;
    };

export type InstagramReconcileResult =
  | { found: true; remotePostId: string; permalinkUrl: string | null; createdAt: string }
  | { found: false }
  | { found: "unknown"; category: PublicationErrorCategory; message: string };

const SAFE_URL = /^https:\/\/[^\s]{1,2000}$/;

function graphUrl(path: string): URL {
  const version = getInstagramGraphApiVersion();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${GRAPH_HOST}/${version}${normalized}`);
}

export const defaultInstagramPublishTransport: InstagramPublishTransport = async (request) => {
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

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readGraphError(body: unknown): {
  code: number | null;
  subcode: number | null;
  message: string | null;
} {
  const error = asRecord(asRecord(body).error);
  return {
    code: typeof error.code === "number" ? error.code : null,
    subcode: typeof error.error_subcode === "number" ? error.error_subcode : null,
    message: typeof error.message === "string" ? error.message.slice(0, 300) : null,
  };
}

/**
 * Classify an Instagram Graph failure. Same Meta error codes as the Facebook
 * adapter (190 token, 10 / 200-299 permission, 4 / 17 / 32 / 613 rate limits,
 * 1 / 2 temporary, 100 invalid parameter, 368 blocked) plus the Instagram
 * publishing codes: 9004 media could not be fetched, 9007 media not ready
 * (retryable), 36000-36003 unsupported media / aspect ratio / caption too
 * long, 25 publishing limit reached (rate limited).
 */
export function classifyInstagramPublishFailure(
  status: number,
  body: unknown,
): { category: PublicationErrorCategory; retryable: boolean; message: string } {
  const error = readGraphError(body);
  const code = error.code;
  const message = error.message ?? `Instagram returned HTTP ${status}.`;
  if (code === 190 || status === 401) {
    return { category: "authorization_expired", retryable: false, message };
  }
  if (code === 10 || (code !== null && code >= 200 && code <= 299) || status === 403) {
    return { category: "permission_denied", retryable: false, message };
  }
  if (code === 4 || code === 17 || code === 25 || code === 32 || code === 613 || status === 429) {
    return { category: "rate_limited", retryable: true, message };
  }
  if (code === 9007) {
    return { category: "provider_unavailable", retryable: true, message };
  }
  if (code === 1 || code === 2 || status >= 500) {
    return { category: "provider_unavailable", retryable: true, message };
  }
  if (code === 100 || code === 368 || code === 9004 || (code !== null && code >= 36000 && code <= 36999) || status === 400) {
    return { category: "invalid_content", retryable: false, message };
  }
  return { category: "unknown", retryable: false, message };
}

function refuse(category: PublicationErrorCategory, message: string): InstagramPublishResult {
  return { ok: false, category, retryable: false, message, ambiguous: false };
}

/** Validate the request before any network call. Exported for the worker. */
export function validateInstagramPublishInput(input: InstagramPublishInput): InstagramPublishResult | null {
  if (!input.igUserId.trim() || !input.accessToken.trim()) {
    return refuse("not_configured", "The Instagram credential is missing.");
  }
  const caption = canonicalCaption(input.caption);
  if (!caption) return refuse("invalid_content", "The caption is empty.");
  if (caption.length > INSTAGRAM_CAPTION_LIMIT) {
    return refuse("invalid_content", `The caption exceeds ${INSTAGRAM_CAPTION_LIMIT} characters.`);
  }
  const image = input.imageUrl?.trim() || null;
  const video = input.videoUrl?.trim() || null;
  if (!image && !video) {
    return refuse("invalid_content", "Instagram needs one public image or video URL; text-only posts are not supported.");
  }
  if (image && video) {
    return refuse("invalid_content", "Instagram accepts one media URL per post.");
  }
  const media = image ?? video ?? "";
  if (!SAFE_URL.test(media)) {
    return refuse("invalid_content", "The media must be a public https URL.");
  }
  return null;
}

async function post(
  transport: InstagramPublishTransport,
  url: URL,
  form: URLSearchParams,
): Promise<InstagramTransportResponse> {
  return transport({
    method: "POST",
    url,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    form,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
}

async function get(
  transport: InstagramPublishTransport,
  url: URL,
  accessToken: string,
): Promise<InstagramTransportResponse> {
  return transport({
    method: "GET",
    url,
    headers: { authorization: `Bearer ${accessToken}` },
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
}

function transportFailure(error: unknown, ambiguous: boolean): InstagramPublishResult {
  const aborted = error instanceof Error && error.name === "AbortError";
  return {
    ok: false,
    category: aborted ? "timeout" : "provider_unavailable",
    retryable: true,
    message: aborted ? "Instagram did not answer in time." : "Instagram could not be reached.",
    ambiguous,
  };
}

/**
 * Publish one image or Reel on the professional account. Returns the media id
 * and, when the follow-up read succeeds, the permalink. Only a transport
 * failure on `media_publish` is `ambiguous`; container failures are safe to
 * retry because a container alone publishes nothing.
 */
export async function publishInstagramMedia(
  input: InstagramPublishInput,
  transport: InstagramPublishTransport = defaultInstagramPublishTransport,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<InstagramPublishResult> {
  const invalid = validateInstagramPublishInput(input);
  if (invalid) return invalid;

  const caption = canonicalCaption(input.caption);
  const userPath = `/${encodeURIComponent(input.igUserId.trim())}`;

  // 1. Container.
  const createForm = new URLSearchParams();
  createForm.set("access_token", input.accessToken);
  createForm.set("caption", caption);
  if (input.videoUrl?.trim()) {
    createForm.set("media_type", "REELS");
    createForm.set("video_url", input.videoUrl.trim());
  } else {
    createForm.set("image_url", (input.imageUrl ?? "").trim());
  }
  let created: InstagramTransportResponse;
  try {
    created = await post(transport, graphUrl(`${userPath}/media`), createForm);
  } catch (error) {
    return transportFailure(error, false);
  }
  if (created.status < 200 || created.status >= 300) {
    return { ok: false, ...classifyInstagramPublishFailure(created.status, created.body), ambiguous: false };
  }
  const containerId = readString(asRecord(created.body), "id");
  if (!containerId) {
    return { ok: false, category: "unknown", retryable: true, message: "Instagram accepted the media without a container id.", ambiguous: false };
  }

  // 2. Bounded status polling.
  const maxPolls = Math.max(1, Math.min(input.maxStatusPolls ?? INSTAGRAM_CONTAINER_MAX_POLLS, 60));
  const interval = Math.max(0, input.pollIntervalMs ?? INSTAGRAM_CONTAINER_POLL_INTERVAL_MS);
  let ready = false;
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    let status: InstagramTransportResponse;
    try {
      const url = graphUrl(`/${encodeURIComponent(containerId)}`);
      url.searchParams.set("fields", "status_code,status");
      status = await get(transport, url, input.accessToken);
    } catch (error) {
      return transportFailure(error, false);
    }
    if (status.status < 200 || status.status >= 300) {
      return { ok: false, ...classifyInstagramPublishFailure(status.status, status.body), ambiguous: false };
    }
    const code = (readString(asRecord(status.body), "status_code") ?? "").toUpperCase();
    if (code === "FINISHED") {
      ready = true;
      break;
    }
    if (code === "ERROR" || code === "EXPIRED") {
      const detail = readString(asRecord(status.body), "status");
      return refuse("invalid_content", detail ? `Instagram could not process the media: ${detail.slice(0, 200)}` : "Instagram could not process the media.");
    }
    if (code === "PUBLISHED") {
      // Should not happen before media_publish; treat as ambiguous so the worker reconciles.
      return { ok: false, category: "unknown", retryable: true, message: "Instagram reports the container as already published.", ambiguous: true };
    }
    if (attempt + 1 < maxPolls && interval > 0) await sleep(interval);
  }
  if (!ready) {
    return { ok: false, category: "timeout", retryable: true, message: "Instagram is still processing the media; the attempt will be retried.", ambiguous: false };
  }

  // 3. Publish.
  const publishForm = new URLSearchParams();
  publishForm.set("access_token", input.accessToken);
  publishForm.set("creation_id", containerId);
  let published: InstagramTransportResponse;
  try {
    published = await post(transport, graphUrl(`${userPath}/media_publish`), publishForm);
  } catch (error) {
    return transportFailure(error, true);
  }
  if (published.status < 200 || published.status >= 300) {
    return { ok: false, ...classifyInstagramPublishFailure(published.status, published.body), ambiguous: false };
  }
  const remotePostId = readString(asRecord(published.body), "id");
  if (!remotePostId) {
    return { ok: false, category: "unknown", retryable: false, message: "Instagram accepted the publication without a media id.", ambiguous: true };
  }

  // 4. Verify (never undoes a successful publish).
  const verification = await verifyInstagramMedia({ remotePostId, accessToken: input.accessToken }, transport);
  return {
    ok: true,
    remotePostId,
    permalinkUrl: verification.ok ? verification.permalinkUrl : null,
    verified: verification.ok,
    containerId,
  };
}

/** Read the published media back for the permalink. */
export async function verifyInstagramMedia(
  input: { remotePostId: string; accessToken: string },
  transport: InstagramPublishTransport = defaultInstagramPublishTransport,
): Promise<{ ok: true; permalinkUrl: string | null; createdAt: string | null } | { ok: false }> {
  try {
    const url = graphUrl(`/${encodeURIComponent(input.remotePostId)}`);
    url.searchParams.set("fields", "id,permalink,timestamp");
    const response = await get(transport, url, input.accessToken);
    if (response.status < 200 || response.status >= 300) return { ok: false };
    const body = asRecord(response.body);
    if (readString(body, "id") !== input.remotePostId) return { ok: false };
    return { ok: true, permalinkUrl: readString(body, "permalink"), createdAt: readString(body, "timestamp") };
  } catch {
    return { ok: false };
  }
}

/**
 * After an ambiguous attempt, look for media with the same caption created
 * since `since` on the account. Used before any retry so a timeout on
 * media_publish never duplicates a post.
 */
export async function reconcileInstagramMedia(
  input: { igUserId: string; accessToken: string; caption: string; since: Date },
  transport: InstagramPublishTransport = defaultInstagramPublishTransport,
): Promise<InstagramReconcileResult> {
  const wanted = canonicalCaption(input.caption);
  if (!wanted) return { found: false };
  try {
    const url = graphUrl(`/${encodeURIComponent(input.igUserId.trim())}/media`);
    url.searchParams.set("fields", "id,caption,timestamp,permalink");
    url.searchParams.set("since", String(Math.floor(input.since.getTime() / 1000)));
    url.searchParams.set("limit", String(MEDIA_RECONCILE_LIMIT));
    const response = await get(transport, url, input.accessToken);
    if (response.status < 200 || response.status >= 300) {
      const failure = classifyInstagramPublishFailure(response.status, response.body);
      return { found: "unknown", category: failure.category, message: failure.message };
    }
    const data = asRecord(response.body).data;
    const rows = Array.isArray(data) ? data : [];
    const sinceMs = input.since.getTime();
    for (const item of rows) {
      const row = asRecord(item);
      const id = readString(row, "id");
      const caption = typeof row.caption === "string" ? canonicalCaption(row.caption) : "";
      const timestamp = readString(row, "timestamp");
      const createdMs = timestamp ? Date.parse(timestamp) : NaN;
      if (Number.isFinite(createdMs) && createdMs < sinceMs) continue;
      if (id && caption === wanted) {
        return {
          found: true,
          remotePostId: id,
          permalinkUrl: readString(row, "permalink"),
          createdAt: timestamp ?? new Date().toISOString(),
        };
      }
    }
    return { found: false };
  } catch {
    return { found: "unknown", category: "provider_unavailable", message: "Instagram could not be reached for reconciliation." };
  }
}
