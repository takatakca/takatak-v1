import { NextResponse } from "next/server";

import { isPhoneOtpConfigured } from "@/lib/auth/otp/env";
import { normalizePhone } from "@/lib/auth/otp/phone";
import { sendOtpToPhone } from "@/lib/auth/otp/send-phone";
import { MasterApiInputError } from "@/lib/integrations/master-api/errors";
import {
  authorizeMasterRequest,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = authorizeMasterRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const { body } = await readMasterJson(request);
    const phone =
      typeof body["phone"] === "string"
        ? normalizePhone(body["phone"])
        : null;

    if (!phone) {
      throw new MasterApiInputError("Valid phone number required.");
    }

    if (!isPhoneOtpConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Phone verification is not configured." },
        { status: 503 },
      );
    }

    await sendOtpToPhone(phone);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return masterApiError(error);
  }
}
