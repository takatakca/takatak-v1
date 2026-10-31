import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { readPushConfig } from "@/lib/push/config";
import { PushRateLimitedError, recordPushSubscription } from "@/lib/push/store";
import { validatePushSubscription } from "@/lib/push/subscription";
import { PUSH_CONSENT_VERSION, pushConsentText } from "@/lib/push/topics";
import { jsonResponse } from "@/lib/security/api-response";
import { readJsonBody } from "@/lib/security/write-request";
import { allowRequest, hashRequestSource } from "@/lib/website-leads/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the device prompt needs: on/off, the public key, the consent wording. */
export async function GET() {
  const config = readPushConfig();
  if (!config.enabled) return jsonResponse({ ok: true, enabled: false }, 200);
  return jsonResponse(
    {
      ok: true,
      enabled: true,
      publicKey: config.vapid.publicKey,
      consentVersion: PUSH_CONSENT_VERSION,
      consentText: { fr: pushConsentText("fr"), en: pushConsentText("en") },
    },
    200,
  );
}

/** Saves a device after our own "Yes" and the browser's permission, with consent proof. */
export async function POST(request: NextRequest) {
  const config = readPushConfig();
  if (!config.enabled) return jsonResponse({ ok: false, code: "not_enabled" }, 503);

  const body = await readJsonBody(request, 4_096);
  if (!body.ok) return jsonResponse({ ok: false, code: "invalid_request" }, body.status);
  const sourceHash = hashRequestSource(request.headers);
  if (!allowRequest(`push:${sourceHash}`)) return jsonResponse({ ok: false, code: "rate_limited" }, 429);

  const validation = validatePushSubscription(body.body);
  if (!validation.ok) return jsonResponse({ ok: false, code: "invalid_fields", fieldErrors: validation.fieldErrors }, 400);

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, code: "unavailable" }, 503);
  const sub = validation.value;
  try {
    await recordPushSubscription(prisma, {
      clientId: config.clientId,
      sub,
      proof: {
        version: PUSH_CONSENT_VERSION,
        text: pushConsentText(sub.language),
        language: sub.language,
        givenAt: new Date().toISOString(),
        sourcePage: sub.sourcePage,
        sourceHash,
        method: "own_prompt_then_browser_permission",
      },
    });
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    if (error instanceof PushRateLimitedError) return jsonResponse({ ok: false, code: "rate_limited" }, 429);
    console.error("[push] subscribe failed", error instanceof Error ? error.name : "unknown");
    return jsonResponse({ ok: false, code: "unavailable" }, 503);
  }
}
