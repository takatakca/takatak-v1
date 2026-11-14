import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/auth/env";
import { isSupabaseAdminConfigured } from "@/lib/auth/supabase-admin";
import { getPrisma } from "@/lib/db/prisma";
import { isRuntimeReady } from "@/lib/ops/runtime-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckState = "ok" | "unavailable" | "not_configured";

async function pingDatabase(): Promise<CheckState> {
  const prisma = getPrisma();
  if (!prisma) {
    return "not_configured";
  }
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), 2_500);
      }),
    ]);
    return "ok";
  } catch {
    return "unavailable";
  }
}

export async function GET() {
  const database = await pingDatabase();
  const supabase: CheckState = isSupabaseConfigured()
    ? isSupabaseAdminConfigured()
      ? "ok"
      : "unavailable"
    : "not_configured";
  const ok = isRuntimeReady({ database, supabase });

  const response = NextResponse.json(
    {
      ok,
      checks: {
        process: "ok",
        database,
        supabase,
      },
    },
    { status: ok ? 200 : 503 },
  );
  response.headers.set("Cache-Control", "no-store");
  // Coolify supplies SOURCE_COMMIT at runtime; expose only a full Git SHA.
  // Absence of a valid SHA is explicitly *not* proof of a deployed revision.
  const sourceCommit = process.env.SOURCE_COMMIT?.trim().toLowerCase();
  if (sourceCommit && /^[0-9a-f]{40}$/.test(sourceCommit)) {
    response.headers.set("X-TAKATAK-Release", sourceCommit);
  }
  return response;
}
