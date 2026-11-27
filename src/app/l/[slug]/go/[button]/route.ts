import { NextRequest, NextResponse } from "next/server";

import { originFromRequest } from "@/lib/config/app-origin";
import { normalizeSmartLinkSlug, normalizeSmartLinkUrl } from "@/lib/social/smartlinks/policy";
import { countSmartLinkEvent, getSmartLinkButtonTarget } from "@/lib/social/smartlinks/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ slug: string; button: string }> };

// Counts one click on a published SmartLink button, then sends the visitor to
// the button's link. Only links saved on that page's own buttons are followed,
// and they are checked again here (https/http only): never an open redirect.
export async function GET(request: NextRequest, context: Context) {
  const { slug: rawSlug, button } = await context.params;
  const slug = normalizeSmartLinkSlug(rawSlug);
  if (!slug || slug !== rawSlug || !UUID.test(button)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const target = await getSmartLinkButtonTarget(slug, button);
  const url = target ? normalizeSmartLinkUrl(target.url) : null;
  if (!target || !url) {
    return NextResponse.redirect(new URL(`/l/${slug}`, originFromRequest(request)), 302);
  }
  await countSmartLinkEvent({ smartLinkId: target.smartLinkId, clientId: target.clientId, buttonId: button });
  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
