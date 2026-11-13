import "server-only";
import { createHash } from "node:crypto";
import { QMAPS_BUSINESS_ID } from "./bridge";

export type QmapsReviewCursor = { createdAt: string; id: string };
export type QmapsSourceReview = {
  id: string;
  businessId: string;
  rating: number;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  ownerReply: string | null;
  ownerRepliedAt: string | null;
};
export type QmapsReviewPage = {
  reviews: QmapsSourceReview[];
  nextCursor: QmapsReviewCursor | null;
};
export type QmapsReadFailure =
  "not_configured" | "refused" | "unreachable" | "invalid_response";
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const timestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
    value,
  ) &&
  Number.isFinite(Date.parse(value));
export function qmapsReviewCursor(value: unknown): QmapsReviewCursor | null {
  const cursor = object(value);
  return typeof cursor.id === "string" &&
    QMAPS_BUSINESS_ID.test(cursor.id) &&
    timestamp(cursor.createdAt)
    ? { id: cursor.id.toLowerCase(), createdAt: cursor.createdAt }
    : null;
}

export function parseQmapsReviewPage(
  input: unknown,
  clientId: string,
  businessId: string,
  limit = 25,
): QmapsReviewPage | null {
  const data = object(input);
  if (
    data.ok !== true ||
    data.version !== 1 ||
    data.clientId !== clientId ||
    data.businessId !== businessId ||
    !Array.isArray(data.reviews) ||
    data.reviews.length > limit
  )
    return null;
  const reviews: QmapsSourceReview[] = [];
  const seen = new Set<string>();
  for (const item of data.reviews) {
    const row = object(item);
    if (
      typeof row.id !== "string" ||
      !QMAPS_BUSINESS_ID.test(row.id) ||
      seen.has(row.id.toLowerCase()) ||
      row.businessId !== businessId ||
      !Number.isInteger(row.rating) ||
      Number(row.rating) < 1 ||
      Number(row.rating) > 5 ||
      !timestamp(row.createdAt) ||
      !timestamp(row.updatedAt) ||
      !(
        row.body === null ||
        (typeof row.body === "string" && row.body.length <= 10000)
      ) ||
      !(
        row.ownerReply === null ||
        (typeof row.ownerReply === "string" && row.ownerReply.length <= 2000)
      ) ||
      !(row.ownerRepliedAt === null || timestamp(row.ownerRepliedAt))
    )
      return null;
    seen.add(row.id.toLowerCase());
    reviews.push({
      id: row.id.toLowerCase(),
      businessId,
      rating: Number(row.rating),
      body: row.body as string | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ownerReply: row.ownerReply as string | null,
      ownerRepliedAt: row.ownerRepliedAt as string | null,
    });
  }
  const nextCursor =
    data.nextCursor === null ? null : qmapsReviewCursor(data.nextCursor);
  if (data.nextCursor !== null && !nextCursor) return null;
  if (
    nextCursor &&
    (!reviews.length ||
      nextCursor.id !== reviews[reviews.length - 1].id ||
      nextCursor.createdAt !== reviews[reviews.length - 1].createdAt)
  )
    return null;
  return { reviews, nextCursor };
}

/** Shared by pull and signed events so racing creates have one immutable key. */
export function qmapsTrackedReviewId(
  clientId: string,
  listingId: string,
  reviewId: string,
): string {
  if (
    ![clientId, listingId, reviewId].every((id) => QMAPS_BUSINESS_ID.test(id))
  )
    throw new Error("invalid_qmaps_identity");
  const hex = createHash("sha256")
    .update(
      JSON.stringify([
        "qmaps.review.v1",
        clientId.toLowerCase(),
        listingId.toLowerCase(),
        reviewId.toLowerCase(),
      ]),
    )
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function readQmapsJSON(
  response: Response,
  maximum = 1048576,
): Promise<unknown> {
  if (
    Number(response.headers.get("content-length")) > maximum ||
    !response.body
  )
    throw new Error("response_too_large");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error("response_too_large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function fetchQmapsReviewPage(
  clientId: string,
  businessId: string,
  cursor: QmapsReviewCursor | null = null,
  fetchImpl: typeof fetch = fetch,
): Promise<
  ({ ok: true } & QmapsReviewPage) | { ok: false; reason: QmapsReadFailure }
> {
  if (
    ![clientId, businessId].every((id) => QMAPS_BUSINESS_ID.test(id)) ||
    (cursor && !qmapsReviewCursor(cursor))
  )
    return { ok: false, reason: "refused" };
  const base = process.env.QMAPS_FUNCTIONS_BASE_URL?.replace(/\/$/, "");
  const secret = process.env.QMAPS_INTEGRATION_SECRET;
  if (!base || !secret || secret.length < 32)
    return { ok: false, reason: "not_configured" };
  let url: URL;
  try {
    url = new URL(base);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return { ok: false, reason: "not_configured" };
  } catch {
    return { ok: false, reason: "not_configured" };
  }
  try {
    const response = await fetchImpl(`${base}/takatak-list-reviews`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-qmaps-integration-secret": secret,
      },
      body: JSON.stringify({
        version: 1,
        clientId,
        businessId,
        limit: 25,
        ...(cursor ? { cursor } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return { ok: false, reason: "refused" };
    let page: QmapsReviewPage | null;
    try {
      page = parseQmapsReviewPage(
        await readQmapsJSON(response),
        clientId,
        businessId,
      );
    } catch {
      return { ok: false, reason: "invalid_response" };
    }
    return page
      ? { ok: true, ...page }
      : { ok: false, reason: "invalid_response" };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

export async function fetchQmapsReviewVisibility(
  clientId: string,
  businessId: string,
  reviewIds: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<
  | { ok: true; unavailableReviewIds: string[] }
  | { ok: false; reason: QmapsReadFailure }
> {
  if (
    ![clientId, businessId].every((id) => QMAPS_BUSINESS_ID.test(id)) ||
    !reviewIds.length ||
    reviewIds.length > 100 ||
    reviewIds.some((id) => !QMAPS_BUSINESS_ID.test(id)) ||
    new Set(reviewIds).size !== reviewIds.length
  )
    return { ok: false, reason: "refused" };
  const base = process.env.QMAPS_FUNCTIONS_BASE_URL?.replace(/\/$/, "");
  const secret = process.env.QMAPS_INTEGRATION_SECRET;
  if (!base || !secret || secret.length < 32)
    return { ok: false, reason: "not_configured" };
  try {
    const url = new URL(base);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return { ok: false, reason: "not_configured" };
  } catch {
    return { ok: false, reason: "not_configured" };
  }
  try {
    const response = await fetchImpl(`${base}/takatak-review-visibility`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-qmaps-integration-secret": secret,
      },
      body: JSON.stringify({ version: 1, clientId, businessId, reviewIds }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status !== 200) return { ok: false, reason: "refused" };
    try {
      const data = object(await readQmapsJSON(response, 64000));
      if (
        data.ok !== true ||
        data.version !== 1 ||
        data.clientId !== clientId ||
        data.businessId !== businessId ||
        !Array.isArray(data.reviews) ||
        data.reviews.length !== reviewIds.length
      )
        return { ok: false, reason: "invalid_response" };
      const seen = new Set<string>(),
        unavailable: string[] = [];
      for (const item of data.reviews) {
        const row = object(item);
        if (
          typeof row.id !== "string" ||
          !reviewIds.includes(row.id) ||
          seen.has(row.id) ||
          typeof row.visible !== "boolean"
        )
          return { ok: false, reason: "invalid_response" };
        seen.add(row.id);
        if (!row.visible) unavailable.push(row.id);
      }
      return { ok: true, unavailableReviewIds: unavailable };
    } catch {
      return { ok: false, reason: "invalid_response" };
    }
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
