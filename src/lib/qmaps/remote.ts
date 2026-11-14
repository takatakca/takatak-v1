import "server-only";
import { QMAPS_BUSINESS_ID } from "./bridge";
import { readQmapsJSON } from "./reviews-api";
import type { QmapsRemoteResult } from "@/lib/qmaps/bridge";

export async function postQmaps(
  path: "takatak-link-business" | "takatak-reply-review-v2",
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<QmapsRemoteResult> {
  const base = process.env.QMAPS_FUNCTIONS_BASE_URL?.replace(/\/$/, "");
  const secret = process.env.QMAPS_INTEGRATION_SECRET;
  if (!base || !secret || secret.length < 32)
    return { ok: false, reason: "not_configured" };
  const input =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  if (
    ![input.clientId, input.businessId].every(
      (id) => typeof id === "string" && QMAPS_BUSINESS_ID.test(id),
    ) ||
    (path === "takatak-reply-review-v2" &&
      (input.version !== 1 ||
        typeof input.reviewId !== "string" ||
        !QMAPS_BUSINESS_ID.test(input.reviewId) ||
        typeof input.body !== "string" ||
        !input.body.trim() ||
        input.body.length > 2000))
  )
    return { ok: false, reason: "refused" };
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
    const response = await fetchImpl(`${base}/${path}`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-qmaps-integration-secret": secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status !== 200) return { ok: false, reason: "refused" };
    const result: unknown = await readQmapsJSON(response, 32768);
    const output =
      result && typeof result === "object"
        ? (result as Record<string, unknown>)
        : {};
    const accepted =
      output.ok === true &&
      (path === "takatak-reply-review-v2"
        ? output.version === 1 &&
          output.ownerReply ===
            String(input.body).trim().replace(/\s+/g, " ") &&
          typeof output.ownerRepliedAt === "string" &&
          Number.isFinite(Date.parse(output.ownerRepliedAt)) &&
          output.reviewId === input.reviewId &&
          output.businessId === input.businessId &&
          output.clientId === input.clientId
        : output.businessId === input.businessId &&
          output.clientId === input.clientId);
    return accepted ? { ok: true } : { ok: false, reason: "refused" };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
