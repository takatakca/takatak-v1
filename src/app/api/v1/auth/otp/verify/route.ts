import { NextResponse } from "next/server";

import { normalizePhone } from "@/lib/auth/otp/phone";
import {
  MasterApiInputError,
  MasterApiUnavailableError,
} from "@/lib/integrations/master-api/errors";
import {
  authorizeMasterApplication,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";
import { resolveVerifiedPhoneIdentity } from "@/lib/integrations/master-api/identity";
import { verifyTakatakPhoneOtp } from "@/lib/integrations/master-api/supabase-phone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const { response: unauthorized, application } = authorizeMasterApplication(
    request,
    ["1lv", "isexy"],
  );
  if (unauthorized) return unauthorized;
  void application;

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

    const verifiedUser = await verifyTakatakPhoneOtp(phone, code);
    const verifiedUserPhone =
      typeof verifiedUser.phone === "string"
        ? normalizePhone(verifiedUser.phone)
        : null;

    if (verifiedUserPhone !== phone || !verifiedUser.phone_confirmed_at) {
      throw new MasterApiInputError(
        "TAKATAK phone verification did not confirm this phone.",
      );
    }

    const meta = verifiedUser.user_metadata ?? {};
    const identity = await resolveVerifiedPhoneIdentity(
      phone,
      verifiedUser.id,
      {
        firstName:
          typeof meta["first_name"] === "string" ? meta["first_name"] : null,
        lastName:
          typeof meta["last_name"] === "string" ? meta["last_name"] : null,
        locale: typeof meta["locale"] === "string" ? meta["locale"] : null,
      },
    );

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
