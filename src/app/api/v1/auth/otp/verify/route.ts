import { NextResponse } from "next/server";

import { normalizePhone } from "@/lib/auth/otp/phone";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { getPrisma } from "@/lib/db/prisma";
import {
  MasterApiConflictError,
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

    const user = await verifyTakatakPhoneOtp(phone, code);

    const hasEmail =
      Boolean(user.email?.trim()) ||
      (typeof user.user_metadata?.email === "string" &&
        Boolean(user.user_metadata.email.trim()));

    let verifiedIdentity: {
      id: string;
      phone: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      locale: string | null;
    } | null = null;

    if (hasEmail) {
      const profile = await ensureProfileForSupabaseUser(user, {
        createPersonalWorkspace: false,
      });

      if (profile.outcome === "denied") {
        throw new MasterApiConflictError(
          "Verified phone conflicts with another TAKATAK identity.",
        );
      }

      if (profile.outcome === "unavailable" || profile.outcome === "error") {
        throw new MasterApiUnavailableError(
          "TAKATAK identity could not be synchronized.",
        );
      }

      const prisma = getPrisma();
      if (!prisma) {
        throw new MasterApiUnavailableError(
          "TAKATAK identity database is unavailable.",
        );
      }

      const identity = await prisma.masterIdentity.findUnique({
        where: { profileId: profile.profileId },
      });

      if (
        identity?.primaryPhoneVerified &&
        identity.primaryPhone === phone
      ) {
        verifiedIdentity = {
          id: identity.id,
          phone: identity.primaryPhone,
          email: identity.primaryEmail,
          firstName: identity.firstName,
          lastName: identity.lastName,
          locale: identity.locale,
        };
      }
    } else {
      const identity = await resolveVerifiedPhoneIdentity(phone);
      if (identity.phone === phone) {
        verifiedIdentity = {
          id: identity.id,
          phone: identity.phone,
          email: identity.email,
          firstName: identity.firstName,
          lastName: identity.lastName,
          locale: identity.locale,
        };
      }
    }

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
