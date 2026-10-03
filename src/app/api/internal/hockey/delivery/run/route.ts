import { NextResponse } from "next/server";

import { runHockeySmsDeliveryBatch } from "@/lib/hockey/delivery/sms-worker";
import { runHockeyCalendarDeliveryBatch } from "@/lib/hockey/calendar/calendar-worker";
import { runHockeyDepartureDeliveryBatch } from "@/lib/hockey/travel/departure-worker";
import { verifyHockeyDeliveryWorker } from "@/lib/hockey/delivery/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const verification = verifyHockeyDeliveryWorker(request);
  if (!verification.valid) {
    return NextResponse.json(
      { ok: false, error: verification.error },
      { status: verification.status },
    );
  }

  try {
    const sms = await runHockeySmsDeliveryBatch({ limit: 25 });
    const calendar = await runHockeyCalendarDeliveryBatch({ limit: 20 });
    const departure = await runHockeyDepartureDeliveryBatch({ limit: 20 });
    return NextResponse.json(
      { ok: true, sms, calendar, departure },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "[hockey-delivery-worker] Batch failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.json(
      { ok: false, error: "Hockey delivery batch failed." },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed." },
    { status: 405 },
  );
}
