import { NextResponse } from "next/server";

import {
  OneLvOtpConflictError,
  verifyOneLvPhoneOtp,
} from "@/lib/integrations/one-lv/otp";
import { readAuthorizedOneLvJson } from "@/lib/integrations/one-lv/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const input = await readAuthorizedOneLvJson(request);
  if (!input.ok) return input.response;

  const body =
    input.body && typeof input.body === "object" && !Array.isArray(input.body)
      ? (input.body as Record<string, unknown>)
      : null;
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  try {
    const result = await verifyOneLvPhoneOtp(phone, code);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status, ...(result.status === 503 ? { headers: { "Retry-After": "30" } } : {}) },
      );
    }

    return NextResponse.json({
      ok: true,
      provider: "takatak",
      identity: result.identity,
    });
  } catch (error) {
    if (error instanceof OneLvOtpConflictError) {
      return NextResponse.json(
        { ok: false, error: "Identity conflict requires review." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Verification could not be completed." },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
}
