import {
  authorizeAhmvExperienceService,
  introspectAhmvExperienceIdentity,
} from "@/lib/billing/hockey/experience-access";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authorizeAhmvExperienceService(request)) {
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
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof (body as Record<string, unknown>).identityId === "string"
      ? ((body as Record<string, unknown>).identityId as string).trim()
      : "";

  if (!isUuid(identityId)) {
    return jsonResponse({ ok: false, message: "Invalid identity." }, 400);
  }

  try {
    const access = await introspectAhmvExperienceIdentity(identityId);
    return jsonResponse({ ok: true, access }, 200);
  } catch (error) {
    return handleApiError(
      "ahmv-experience-introspection",
      error,
      "AHMV access could not be verified.",
    );
  }
}
