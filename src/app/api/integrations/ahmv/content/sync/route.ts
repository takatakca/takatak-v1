import { NextResponse } from "next/server";
import { verifyAhmvContentRequest } from "@/lib/contributions/ahmv-auth";
import { syncAhmvManagedContent } from "@/lib/contributions/service";
import { parseContentRegistryItems } from "@/lib/contributions/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = verifyAhmvContentRequest(request.headers);
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const items = parseContentRegistryItems(body);
  if (!items) {
    return NextResponse.json({ ok: false, error: "Invalid content registry payload." }, { status: 400 });
  }

  try {
    const result = await syncAhmvManagedContent(items);
    return NextResponse.json({ ok: true, ...result }, {
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CONTENT_SYNC_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
