import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/auth/env";
import { isSupabaseAdminConfigured } from "@/lib/auth/supabase-admin";
import { getPrisma } from "@/lib/db/prisma";
import { readRedisReadiness } from "@/lib/queue/redis";

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
  const redis = await readRedisReadiness();
  const supabase: CheckState = isSupabaseConfigured()
    ? isSupabaseAdminConfigured()
      ? "ok"
      : "unavailable"
    : "not_configured";
  const requireDatabase = process.env.TAKATAK_READY_REQUIRE_DATABASE === "true";
  const databaseReady = requireDatabase ? database === "ok" : database !== "unavailable";
  const ok =
    databaseReady && supabase !== "unavailable" && redis !== "unavailable";

  const response = NextResponse.json(
    {
      ok,
      checks: {
        process: "ok",
        database,
        supabase,
        redis,
      },
    },
    { status: ok ? 200 : 503 },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
