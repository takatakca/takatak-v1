import { NextResponse } from "next/server";

import { normalizePhone } from "@/lib/auth/otp/phone";
import {
  MasterApiInputError,
  MasterApiUnavailableError,
} from "@/lib/integrations/master-api/errors";
import {
  authorizeMasterRequest,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";
import { resolveVerifiedPhoneIdentity } from "@/lib/integrations/master-api/identity";
import { verifyTakatakPhoneOtp } from "@/lib/integrations/master-api/supabase-phone";

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

    await verifyTakatakPhoneOtp(phone, code);

    const identity = await resolveVerifiedPhoneIdentity(phone);

    const verifiedIdentity =
      identity.phone === phone
        ? {
            id: identity.id,
            phone: identity.phone,
            email: identity.email,
            firstName: identity.firstName,
            lastName: identity.lastName,
            locale: identity.locale,
          }
        : null;

    if (!verifiedIdentity) {
      throw new MasterApiUnavailableError(
        "TAKATAK verified identity was not finalized.",
      );
    }

    return NextResponse.json({
      ok: true,
      authority: "takatak_supabase_phone",
      identity: {
        id: verifiedIdentity.id,
        phone: verifiedIdentity.phone,
        email: verifiedIdentity.email,
        first_name: verifiedIdentity.firstName,
        last_name: verifiedIdentity.lastName,
        locale: verifiedIdentity.locale,
      },
    });
  } catch (error) {
    return masterApiError(error);
  }
}
