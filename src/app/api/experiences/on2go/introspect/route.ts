import {
  authorizeOn2goExperienceService,
  introspectOn2goIdentity,
} from "@/lib/integrations/on2go/experience-access";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ON2GO Hub re-checks a session's identity (still active, contact still verified) with its service token.
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

  const identityId =
    body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).identityId === "string"
      ? ((body as Record<string, unknown>).identityId as string).trim()
      : "";
  if (!isUuid(identityId)) {
    return jsonResponse({ ok: false, message: "identityId must be a UUID." }, 400);
  }

  try {
    const result = await introspectOn2goIdentity(identityId);
    const response = jsonResponse({ ok: true, ...result }, 200);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleApiError("on2go-experience-introspect", error, "ON2GO introspection failed.");
  }
}
