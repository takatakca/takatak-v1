import { NextRequest, NextResponse } from "next/server";

import { cleanMessage, publicWidget, visitorMessages, visitorSend } from "@/lib/chat/service";
import { createFixedWindowLimiter, hashedClientKey } from "@/lib/security/fixed-window-limiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 8192;
const sendLimiter = createFixedWindowLimiter({ windowMs: 5 * 60_000, max: 20 });
const pollLimiter = createFixedWindowLimiter({ windowMs: 60_000, max: 90 });

function reply(body: unknown, status: number, origin: string | null): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Origin");
  if (origin) response.headers.set("Access-Control-Allow-Origin", origin);
  return response;
}

export async function OPTIONS(): Promise<NextResponse> {
  // The widget only sends CORS-safelisted requests (GET, text/plain POST).
  return new NextResponse(null, { status: 204 });
}

/**
 * GET ?k=<widget key>                       → widget config
 * GET ?k=<widget key>&v=<visitor token>&after=<iso> → visitor's messages
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  if (!pollLimiter.allow(hashedClientKey(request.headers, "chat-poll"))) return reply({ ok: false, error: "rate_limited" }, 429, null);
  const key = request.nextUrl.searchParams.get("k") ?? "";
  try {
    const widget = await publicWidget(key, origin);
    if (!widget) return reply({ ok: false }, 404, null);
    const allowOrigin = origin!.toLowerCase();
    const visitorToken = request.nextUrl.searchParams.get("v");
    if (!visitorToken) {
      return reply(
        { ok: true, widget: { name: widget.name, greeting: widget.greeting, accentColor: widget.accentColor, whatsappNumber: widget.whatsappNumber } },
        200,
        allowOrigin,
      );
    }
    const thread = await visitorMessages(widget, visitorToken, request.nextUrl.searchParams.get("after"));
    if (!thread) return reply({ ok: false, error: "unknown_conversation" }, 404, allowOrigin);
    return reply({ ok: true, ...thread }, 200, allowOrigin);
  } catch {
    console.error("[chat] public GET failed");
    return reply({ ok: false }, 503, null);
  }
}

/** POST (text/plain JSON) { k, v?, body, name?, email?, phone?, page? } */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  if (!sendLimiter.allow(hashedClientKey(request.headers, "chat-send"))) return reply({ ok: false, error: "rate_limited" }, 429, null);
  let raw: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply({ ok: false }, 413, null);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad");
    raw = parsed as Record<string, unknown>;
  } catch {
    return reply({ ok: false }, 400, null);
  }
  try {
    const widget = await publicWidget(typeof raw.k === "string" ? raw.k : "", origin);
    if (!widget) return reply({ ok: false }, 404, null);
    const allowOrigin = origin!.toLowerCase();
    if (typeof raw.website === "string" && raw.website.trim()) return reply({ ok: false }, 400, allowOrigin);
    const body = cleanMessage(raw.body);
    if (!body) return reply({ ok: false, error: "empty" }, 400, allowOrigin);
    const result = await visitorSend(widget, {
      visitorToken: typeof raw.v === "string" ? raw.v : null,
      body,
      name: raw.name,
      email: raw.email,
      phone: raw.phone,
      pageUrl: raw.page,
    });
    if ("error" in result) return reply({ ok: false, error: result.error }, result.error === "closed" ? 409 : 404, allowOrigin);
    return reply({ ok: true, ...result }, 201, allowOrigin);
  } catch {
    console.error("[chat] public POST failed");
    return reply({ ok: false }, 503, null);
  }
}
