import { NextResponse } from "next/server";

import { collectAhmvBackendReadiness, summarizeAhmvBackendReadiness } from "@/lib/hockey/ops/readiness";
import { collectAhmvOperationalReadiness } from "@/lib/hockey/ops/operational-readiness";
import { requireAdminApiAccess } from "@/lib/security/api-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;

  const configuration = summarizeAhmvBackendReadiness(
    collectAhmvBackendReadiness(),
  );
  const operational = await collectAhmvOperationalReadiness();

  const response = NextResponse.json({
    ok: configuration.productionSafe && operational.ready,
    configuration,
    operational,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
