import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse } from "@/lib/security/api-response";
import { readJsonBody } from "@/lib/security/write-request";
import { allowRequest, hashRequestSource } from "@/lib/website-leads/rate-limit";
import { verifyToken } from "@/lib/newsletter/consent";
import { readNewsletterLinkConfig } from "@/lib/newsletter/config";
import { applyLink } from "@/lib/newsletter/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Double opt-in: the confirmation page posts the token from the email link
 * after a click (a mail scanner opening the link confirms nothing).
 */
export async function POST(request: NextRequest) {
  const config = readNewsletterLinkConfig();
  if (!config) return jsonResponse({ ok: false, code: "not_enabled" }, 503);

  const body = await readJsonBody(request, 1_024);
  if (!body.ok) return jsonResponse({ ok: false, code: "invalid_request" }, body.status);
  if (!allowRequest(`newsletter:${hashRequestSource(request.headers)}`)) return jsonResponse({ ok: false, code: "rate_limited" }, 429);

  const token = (body.body as Record<string, unknown> | null)?.token;
  const link = verifyToken(token, "confirm", config.secret);
  if (!link) return jsonResponse({ ok: false, code: "invalid_link" }, 400);

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, code: "unavailable" }, 503);
  const status = await applyLink(prisma, { clientId: config.clientId, id: link.id, stamp: link.stamp, action: "confirm" });
  if (!status) return jsonResponse({ ok: false, code: "invalid_link" }, 404);
  if (status === "expired_link") return jsonResponse({ ok: false, code: "expired_link" }, 410);
  return jsonResponse({ ok: true, status }, 200);
}
