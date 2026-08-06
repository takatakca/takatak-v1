import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/security/api-access";
import { getProviderStatus } from "@/lib/integrations/upmind/adapter";

export const dynamic = "force-dynamic";

export async function GET() {
  // Phase 14 — admin-only detailed status (missing env VAR NAMES are listed,
  // so this must never be public in a configured production environment).
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  // Safe metadata only — never secret values.
  return NextResponse.json(getProviderStatus());
}
