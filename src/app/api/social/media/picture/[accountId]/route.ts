import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { fetchFacebookAccountPicture } from "@/lib/social/media/facebook-picture";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fresh Facebook Page picture for the brand dropdown and sidebar.
 * Looks up the Page server-side; never puts Page IDs or tokens in the <img> src.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ accountId: string }> },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("view_social");
  if (!gate.ok) {
    return new NextResponse(null, { status: gate.response.status });
  }

  const { accountId } = await context.params;
  if (!isUuid(accountId)) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const picture = await fetchFacebookAccountPicture({
      clientId: gate.access.activeClientId,
      accountId,
    });

    if (!picture) {
      return new NextResponse(null, { status: 404 });
    }

    if ("redirectTo" in picture) {
      const response = NextResponse.redirect(picture.redirectTo, 302);
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }

    const body = Uint8Array.from(picture.bytes);
    return new NextResponse(body as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": picture.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
