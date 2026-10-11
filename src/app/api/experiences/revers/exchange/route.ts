import {
  authorizeReversExperienceService,
  exchangeReversExperienceLaunch,
} from "@/lib/experiences/revers-experience-access";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authorizeReversExperienceService(request)) {
    return jsonResponse({ ok: false, message: "Forbidden." }, 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ ok: false, message: "JSON required." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 2048) {
    return jsonResponse({ ok: false, message: "Request too large." }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid JSON." }, 400);
  }

  const code =
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof (body as Record<string, unknown>).code === "string"
      ? ((body as Record<string, unknown>).code as string)
      : "";

  try {
    const session = await exchangeReversExperienceLaunch(code);
    const response = jsonResponse({ ok: true, session }, 200);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  } catch (error) {
    return handleApiError(
      "revers-experience-exchange",
      error,
      "REVERS launch exchange failed.",
    );
  }
}
