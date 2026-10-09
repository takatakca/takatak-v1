import { NextResponse } from "next/server";
import { verifyAhmvContentRequest } from "@/lib/contributions/ahmv-auth";
import { acknowledgeAhmvPublication } from "@/lib/contributions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ publicationId: string }> },
) {
  const auth = verifyAhmvContentRequest(request.headers);
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { publicationId } = await context.params;
  const body = await request.json().catch(() => null) as
    | { applied?: unknown; snapshot?: unknown }
    | null;

  if (!body || typeof body.applied !== "boolean") {
    return NextResponse.json({ ok: false, error: "Invalid acknowledgement payload." }, { status: 400 });
  }

  const snapshot =
    body.snapshot && typeof body.snapshot === "object" && !Array.isArray(body.snapshot)
      ? body.snapshot as Record<string, unknown>
      : undefined;

  try {
    const result = await acknowledgeAhmvPublication({
      publicationId,
      applied: body.applied,
      ...(snapshot ? { snapshot } : {}),
    });
    return NextResponse.json({ ok: true, ...result }, {
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ACK_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: message === "PUBLICATION_NOT_FOUND" ? 404 : 500 });
  }
}
