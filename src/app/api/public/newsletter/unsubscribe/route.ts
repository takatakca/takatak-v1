import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse } from "@/lib/security/api-response";
import { verifyToken } from "@/lib/newsletter/consent";
import { readNewsletterLinkConfig } from "@/lib/newsletter/config";
import { applyLink } from "@/lib/newsletter/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function tokenFrom(request: NextRequest): Promise<unknown> {
  const fromQuery = request.nextUrl.searchParams.get("t");
  if (fromQuery) return fromQuery;
  if ((request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    const text = await request.text();
    if (text.length > 1_024) return null;
    try {
      return (JSON.parse(text) as Record<string, unknown> | null)?.token;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Unsubscribe, effective at once. The signed token is the only credential,
 * so this also serves one-click unsubscribe from mail apps (RFC 8058:
 * List-Unsubscribe=One-Click posted to ?t=<token>, from any origin). No rate
 * limit: mail apps post from shared servers, and a withdrawal must never fail.
 */
export async function POST(request: NextRequest) {
  const config = readNewsletterLinkConfig();
  if (!config) return jsonResponse({ ok: false, code: "not_enabled" }, 503);

  const id = verifyToken(await tokenFrom(request), "unsubscribe", config.secret)?.id;
  if (!id) return jsonResponse({ ok: false, code: "invalid_link" }, 400);

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, code: "unavailable" }, 503);
  const status = await applyLink(prisma, { clientId: config.clientId, id, action: "unsubscribe" });
  if (!status) return jsonResponse({ ok: false, code: "invalid_link" }, 404);
  return jsonResponse({ ok: true, status }, 200);
}
