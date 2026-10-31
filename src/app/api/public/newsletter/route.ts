import { after, type NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse } from "@/lib/security/api-response";
import { readJsonBody } from "@/lib/security/write-request";
import { allowRequest, hashRequestSource } from "@/lib/website-leads/rate-limit";
import { CONSENT_VERSION, consentText, validateSignup } from "@/lib/newsletter/consent";
import { newsletterReady, sendConfirmation } from "@/lib/newsletter/server";
import { NewsletterRateLimitedError, recordSignup } from "@/lib/newsletter/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_096;

/** What the sign-up form shows: who is asking, and the exact consent wording. */
export async function GET() {
  const config = newsletterReady();
  if (!config.enabled) return jsonResponse({ ok: true, enabled: false }, 200);
  return jsonResponse(
    {
      ok: true,
      enabled: true,
      consentVersion: CONSENT_VERSION,
      consentText: { fr: consentText("fr", config.sender), en: consentText("en", config.sender) },
      sender: config.sender,
    },
    200,
  );
}

/** Sign-up: records the consent as proof, then emails a confirmation link. */
export async function POST(request: NextRequest) {
  const config = newsletterReady();
  if (!config.enabled) return jsonResponse({ ok: false, code: "not_enabled" }, 503);

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return jsonResponse({ ok: false, code: "invalid_request", message: body.message }, body.status);

  const sourceHash = hashRequestSource(request.headers);
  if (!allowRequest(sourceHash)) return jsonResponse({ ok: false, code: "rate_limited" }, 429);

  const validation = validateSignup(body.body);
  if (!validation.ok) {
    return jsonResponse({ ok: false, code: "invalid_fields", fieldErrors: validation.fieldErrors }, 400);
  }
  // Bots that fill the hidden field get the normal answer; nothing is stored.
  if (validation.honeypot) return jsonResponse({ ok: true, status: "pending" }, 200);

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, code: "unavailable" }, 503);

  const signup = validation.value;
  const now = new Date();
  try {
    const recorded = await recordSignup(prisma, {
      clientId: config.clientId,
      signup,
      now,
      proof: {
        version: CONSENT_VERSION,
        text: consentText(signup.language, config.sender),
        language: signup.language,
        givenAt: now.toISOString(),
        sourcePage: signup.sourcePage,
        sourceHash,
        method: "web_form_checkbox",
      },
    });
    if (recorded.sendConfirmation) {
      after(async () => {
        const status = await sendConfirmation({
          to: signup.email,
          id: recorded.id,
          lang: signup.language,
          sender: config.sender,
          secret: config.secret,
        });
        if (status !== "sent") console.warn(`[newsletter] confirmation email ${status}`);
      });
    }
    // Same answer whether the address was new, pending or already confirmed.
    return jsonResponse({ ok: true, status: "pending" }, 200);
  } catch (error) {
    if (error instanceof NewsletterRateLimitedError) return jsonResponse({ ok: false, code: "rate_limited" }, 429);
    console.error("[newsletter] sign-up failed", error instanceof Error ? error.name : "unknown");
    return jsonResponse({ ok: false, code: "unavailable" }, 503);
  }
}
