import { NextResponse } from "next/server";

import { normalizePhone } from "@/lib/auth/otp/phone";
import { MasterApiInputError } from "@/lib/integrations/master-api/errors";
import {
  authorizeMasterRequest,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";
import { sendTakatakPhoneOtp } from "@/lib/integrations/master-api/supabase-phone";

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
    const fullName =
      typeof body["full_name"] === "string"
        ? body["full_name"].trim().slice(0, 200)
        : null;
    const preferredLanguage =
      typeof body["preferred_language"] === "string"
        ? body["preferred_language"].trim().slice(0, 16)
        : null;

    if (!phone) {
      throw new MasterApiInputError("Valid phone number required.");
    }

    await sendTakatakPhoneOtp(phone, {
      fullName,
      preferredLanguage,
    });

    return NextResponse.json(
      {
        ok: true,
        authority: "takatak_supabase_phone",
      },
      { status: 200 },
    );
  } catch (error) {
    return masterApiError(error);
  }
}
