import type { AdsTargetingContext } from "./types";

export type PublicAdsJsonResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; message: string };

const CONTEXT_LIMITS: Readonly<Record<keyof AdsTargetingContext, number>> = {
  country: 80,
  region: 120,
  city: 120,
  postalPrefix: 3,
  category: 120,
  locale: 16,
  device: 24,
};

export function sanitizePublicAdsContext(
  input: unknown,
): AdsTargetingContext | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }

  const raw = input as Record<string, unknown>;
  const result: AdsTargetingContext = {};
  for (const key of Object.keys(CONTEXT_LIMITS) as Array<keyof AdsTargetingContext>) {
    const value = raw[key];
    if (typeof value !== "string") continue;

    const max = CONTEXT_LIMITS[key];
    const cleaned =
      key === "postalPrefix"
        ? value.replace(/[^a-z0-9]/gi, "").slice(0, max).toUpperCase()
        : value.trim().slice(0, max);

    if (!cleaned) continue;
    if (
      key === "device" &&
      !["mobile", "desktop", "tablet"].includes(cleaned.toLowerCase())
    ) continue;

    result[key] = cleaned;
  }
  return result;
}

/**
 * This endpoint is intentionally cross-origin for registered publishers.
 * Do not use the same-origin admin write-request guard here.
 * Read a bounded stream so a forged Content-Length cannot bypass the limit.
 */
export async function readPublicAdsJson(
  request: Request,
  maximumBytes = 4096,
): Promise<PublicAdsJsonResult> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();

  if (mediaType !== "application/json") {
    return { ok: false, status: 415, message: "This endpoint requires JSON." };
  }

  const length = request.headers.get("content-length");
  if (length !== null) {
    const declared = Number(length);
    if (!Number.isSafeInteger(declared) || declared < 0) {
      return { ok: false, status: 400, message: "Invalid request size." };
    }
    if (declared > maximumBytes) {
      return { ok: false, status: 413, message: "Request is too large." };
    }
  }

  if (!request.body) {
    return { ok: false, status: 400, message: "Invalid request." };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413, message: "Request is too large." };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, message: "Invalid request." };
  } finally {
    reader.releaseLock();
  }

  try {
    const decoded = Buffer.concat(chunks).toString("utf8");
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, status: 400, message: "Invalid request." };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400, message: "Invalid request." };
  }
}
