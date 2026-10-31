import { NextRequest, NextResponse } from "next/server";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { getReviewCockpit } from "@/lib/reputation/cockpit";
import { cockpitCSV, filterCockpit } from "@/lib/reputation/cockpit-model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(request: NextRequest) {
  const { access } = await getServerAccessContext();
  if (
    access.mode !== "client_scoped" ||
    !hasEffectivePermission(access, "view_reputation")
  )
    return NextResponse.json(
      { ok: false, error: "Select an authorized reputation workspace." },
      { status: 403, headers },
    );
  try {
    const snapshot = await getReviewCockpit(access.activeClientId);
    if (snapshot.unavailable.length === 3)
      return NextResponse.json(
        { ok: false, error: "All review sources are temporarily unavailable." },
        { status: 503, headers },
      );
    const records = filterCockpit(snapshot.records, {
      source: request.nextUrl.searchParams.get("source") || "all",
      query: request.nextUrl.searchParams.get("q") || "",
      state: request.nextUrl.searchParams.get("state") || "all",
      rating: [1, 2, 3, 4, 5].includes(
        Number(request.nextUrl.searchParams.get("rating")),
      )
        ? Number(request.nextUrl.searchParams.get("rating"))
        : null,
      days: [30, 90].includes(Number(request.nextUrl.searchParams.get("days")))
        ? Number(request.nextUrl.searchParams.get("days"))
        : null,
    });
    if (request.nextUrl.searchParams.get("format") === "csv")
      return new NextResponse(cockpitCSV(records), {
        headers: {
          ...headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="takatak-review-window.csv"',
          "X-TAKATAK-Partial": String(
            snapshot.unavailable.length > 0 || snapshot.truncated.length > 0,
          ),
        },
      });
    return NextResponse.json({ ok: true, ...snapshot, records }, { headers });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Review data is temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
