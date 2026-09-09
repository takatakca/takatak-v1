import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/auth/env";
import { isSupabaseAdminConfigured } from "@/lib/auth/supabase-admin";
import { getPrisma } from "@/lib/db/prisma";

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
  const ok = database !== "unavailable" && supabase !== "unavailable";

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
  return response;
}
