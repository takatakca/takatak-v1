import { NextResponse } from "next/server";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { reviewContribution } from "@/lib/contributions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ contributionId: string }> },
) {
  const gate = await requireWorkspaceApiPermission("approve_content");
  if (!gate.ok) return gate.response;

  const { contributionId } = await context.params;
  const body = await request.json().catch(() => null) as
    | {
        decision?: unknown;
        comment?: unknown;
        officialSourceVerified?: unknown;
      }
    | null;

  const decision =
    body?.decision === "approve" ||
    body?.decision === "reject" ||
    body?.decision === "changes_requested"
      ? body.decision
      : null;

  if (!decision) {
    return NextResponse.json({ ok: false, error: "Invalid moderation decision." }, { status: 400 });
  }

  try {
    const result = await reviewContribution({
      clientId: gate.access.activeClientId,
      contributionId,
      moderatorProfileId: gate.access.profileId,
      decision,
      ...(typeof body?.comment === "string" ? { comment: body.comment } : {}),
      officialSourceVerified: body?.officialSourceVerified === true,
    });
    return NextResponse.json({ ok: true, ...result }, {
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REVIEW_FAILED";
    const status =
      message === "CONTRIBUTION_NOT_FOUND" ? 404 :
      message === "OFFICIAL_SOURCE_VERIFICATION_REQUIRED" ? 409 :
      message === "CONTRIBUTION_NOT_REVIEWABLE" ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
