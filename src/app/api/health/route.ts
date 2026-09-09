import { NextResponse } from "next/server";

import { isEmailOtpConfigured, isPhoneOtpConfigured } from "@/lib/auth/otp/env";
import { isSupabaseConfigured } from "@/lib/auth/env";
import { isSupabaseAdminConfigured } from "@/lib/auth/supabase-admin";
import { getDatabaseEnvStatus } from "@/lib/db/env";
import { getPrisma } from "@/lib/db/prisma";
import { getMetricoolEnvStatus } from "@/lib/integrations/metricool/env";
import { getUpmindEnvStatus } from "@/lib/integrations/upmind/env";
import { getStripeSecretKey, getStripeWebhookSecret } from "@/lib/billing/social/stripe-env";

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

function json(body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET() {
  const detailsEnabled =
    process.env.HEALTH_DETAILS_ENABLED === "true" ||
    process.env.NODE_ENV !== "production";

  if (!detailsEnabled) {
    return json({
      status: "ok",
      app: "TAKATAK User Official Dashboard V1",
      alive: true,
    });
  }

  const dbStatus = getDatabaseEnvStatus();
  const database = await pingDatabase();
  const supabase: CheckState = isSupabaseConfigured()
    ? isSupabaseAdminConfigured()
      ? "ok"
      : "unavailable"
    : "not_configured";

  const coreOk = database !== "unavailable";

  const upmind = getUpmindEnvStatus();
  const metricool = getMetricoolEnvStatus();
  const stripeConfigured = Boolean(
    getStripeSecretKey() && getStripeWebhookSecret(),
  );

  return json({
    status: coreOk ? "ok" : "degraded",
    app: "TAKATAK User Official Dashboard V1",
    alive: true,
    checks: {
      process: "ok",
      database,
      databaseConfigured: dbStatus.configured,
      supabase,
      emailOtp: isEmailOtpConfigured() ? "ok" : "not_configured",
      phoneOtp: isPhoneOtpConfigured() ? "ok" : "not_configured",
      stripe: stripeConfigured ? "ok" : "not_configured",
      upmind: upmind.configured ? "ok" : "not_configured",
      metricool: metricool.configured ? "ok" : "not_configured",
    },
  });
}
