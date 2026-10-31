import type { QmapsRemoteResult } from "@/lib/qmaps/bridge";

export async function postQmaps(
  path: "takatak-link-business" | "takatak-reply-review",
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<QmapsRemoteResult> {
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
    if (!response.ok) return { ok: false, reason: "refused" };
    const result: unknown = await response.json();
    const input =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const output =
      result && typeof result === "object"
        ? (result as Record<string, unknown>)
        : {};
    const accepted =
      output.ok === true &&
      (path === "takatak-reply-review"
        ? output.reviewId === input.reviewId
        : output.businessId === input.businessId &&
          output.clientId === input.clientId);
    return accepted ? { ok: true } : { ok: false, reason: "refused" };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
