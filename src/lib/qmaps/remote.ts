import type { QmapsRemoteResult } from "@/lib/qmaps/bridge";

export async function postQmaps(path: "takatak-link-business" | "takatak-reply-review", body: unknown): Promise<QmapsRemoteResult> {
  const base = process.env.QMAPS_FUNCTIONS_BASE_URL?.replace(/\/$/, "");
  const secret = process.env.QMAPS_INTEGRATION_SECRET;
  if (!base || !secret) return { ok: false, reason: "not_configured" };
  try {
    const response = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-qmaps-integration-secret": secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok ? { ok: true } : { ok: false, reason: "refused" };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
