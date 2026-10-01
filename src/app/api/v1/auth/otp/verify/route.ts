import { NextResponse } from "next/server";

import { isPhoneOtpConfigured } from "@/lib/auth/otp/env";
import { normalizePhone } from "@/lib/auth/otp/phone";
import { checkOtpFromPhone } from "@/lib/auth/otp/send-phone";
import { MasterApiInputError } from "@/lib/integrations/master-api/errors";
import {
  authorizeMasterRequest,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";
import { resolveVerifiedPhoneIdentity } from "@/lib/integrations/master-api/identity";

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
    const code =
      typeof body["code"] === "string"
        ? body["code"].trim()
        : "";

    if (!phone || !/^\d{6}$/.test(code)) {
      throw new MasterApiInputError(
        "Phone and 6-digit code are required.",
      );
    }

    if (!isPhoneOtpConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Phone verification is not configured." },
        { status: 503 },
      );
    }

    const verified = await checkOtpFromPhone(phone, code);
    if (!verified) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired verification code." },
        { status: 400 },
      );
    }

    const identity = await resolveVerifiedPhoneIdentity(phone);

    return NextResponse.json({
      ok: true,
      identity: {
        id: identity.id,
        phone: identity.phone,
        email: identity.email,
        first_name: identity.firstName,
        last_name: identity.lastName,
        locale: identity.locale,
      },
    });
  } catch (error) {
    return masterApiError(error);
  }
}
