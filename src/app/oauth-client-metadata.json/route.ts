import { NextResponse } from "next/server";

import { getBlueskyClientMetadata } from "@/lib/social/providers/bluesky-oauth-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    getBlueskyClientMetadata(),
    {
      headers: {
        "Cache-Control":
          "public, max-age=300, stale-while-revalidate=300",
      },
    },
  );
}
