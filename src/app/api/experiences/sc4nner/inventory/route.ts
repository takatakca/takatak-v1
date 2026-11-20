import { authorizeSc4nnerExchange } from "@/lib/experiences/sc4nner-experience-access";
import { listSc4nnerInventoryCatalogs } from "@/lib/experiences/sc4nner-inventory-access";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-to-server only, protected by the same SC4NNER service token as the
// launch exchange. SC4NNER posts the master identity of its signed-in user;
// V1 answers with the inventory catalogs that identity may view. Read-only:
// nothing is written, and no label data ever travels back to V1.
export async function POST(request: Request) {
  if (!authorizeSc4nnerExchange(request))
    return jsonResponse({ ok: false, message: "Forbidden." }, 403);
  if (
    !(request.headers.get("content-type") || "")
      .toLowerCase()
      .startsWith("application/json")
  )
    return jsonResponse({ ok: false, message: "JSON required." }, 415);
  const length = Number(request.headers.get("content-length") || "0");
  if (!Number.isFinite(length) || length > 2048)
    return jsonResponse({ ok: false, message: "Request too large." }, 413);
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid JSON." }, 400);
  }
  const masterIdentityId =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>).masterIdentityId
      : undefined;
  if (
    typeof masterIdentityId !== "string" ||
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      masterIdentityId,
    )
  )
    return jsonResponse({ ok: false, message: "Invalid master identity." }, 400);
  try {
    const catalogs = await listSc4nnerInventoryCatalogs(masterIdentityId);
    const response = jsonResponse({ ok: true, ...catalogs }, 200);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  } catch (error) {
    return handleApiError(
      "sc4nner-inventory",
      error,
      "SC4NNER inventory lookup failed.",
    );
  }
}
