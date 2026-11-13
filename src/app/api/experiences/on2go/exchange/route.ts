import {
  authorizeOn2goExperienceService,
  exchangeOn2goExperienceLaunch,
} from "@/lib/integrations/on2go/experience-access";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ON2GO Hub (Food Hub) exchanges the one-time code for a short session, server to server, with its own service token.
export async function POST(request: Request) {
  if (!authorizeOn2goExperienceService(request)) {
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
    body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).code === "string"
      ? ((body as Record<string, unknown>).code as string)
      : "";

  try {
    const session = await exchangeOn2goExperienceLaunch(code);
    const response = jsonResponse({ ok: true, session }, 200);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleApiError("on2go-experience-exchange", error, "ON2GO launch exchange failed.");
  }
}
