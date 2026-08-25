import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { isAllowedSocialImageUrl } from "@/lib/social/media/remote-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_500_000;

/**
 * Same-origin avatar proxy. Browser <img> requests include the session cookie.
 * Only Facebook/Instagram image hosts are fetched.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("view_social");
  if (!gate.ok) {
    return new NextResponse(null, { status: gate.response.status });
  }

  const source = request.nextUrl.searchParams.get("u")?.trim() ?? "";
  if (!isAllowedSocialImageUrl(source)) {
    return new NextResponse(null, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(source, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "image/*",
        Referer: "",
      },
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new NextResponse(null, { status: 502 });
    }

    const buffer = new Uint8Array(await upstream.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) {
      return new NextResponse(null, { status: 502 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType.split(";")[0] ?? "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
