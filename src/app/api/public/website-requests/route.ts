import { after, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse } from "@/lib/security/api-response";
import { redactSecrets } from "@/lib/security/redact";
import { readJsonBody } from "@/lib/security/write-request";
import { createUploadToken } from "@/lib/website-leads/attachments";
import { readWebsiteLeadsConfig } from "@/lib/website-leads/config";
import { sendLeadAlert } from "@/lib/website-leads/notify";
import { priceMarketplaceOrder } from "@/lib/website-leads/package-pricing";
import { loadPublicCatalogRows } from "@/lib/website/load-public-catalog";
import { allowRequest, hashRequestSource } from "@/lib/website-leads/rate-limit";
import {
  recordWebsiteRequest,
  referenceFor,
  WebsiteLeadRateLimitedError,
} from "@/lib/website-leads/store";
import { hasContact, validateWebsiteRequest } from "@/lib/website-leads/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_384;

async function sessionIdentity(): Promise<{ id: string; email: string | null } | null> {
  try {
    const user = await getSessionUser();
    return user ? { id: user.id, email: user.email ?? null } : null;
  } catch {
    return null;
  }
}

/** Public takatak.ca form intake → Lead in the TAKATAK agency workspace. */
export async function POST(request: NextRequest) {
  const config = readWebsiteLeadsConfig();
  if (!config.enabled) {
    return jsonResponse({ ok: false, code: "not_enabled" }, 503);
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return jsonResponse({ ok: false, code: "invalid_request", message: body.message }, body.status);
  }

  const sourceHash = hashRequestSource(request.headers);
  if (!allowRequest(sourceHash)) {
    return jsonResponse({ ok: false, code: "rate_limited" }, 429);
  }

  const validation = validateWebsiteRequest(body.body);
  if (!validation.ok) {
    return jsonResponse(
      { ok: false, code: "invalid_fields", fieldErrors: validation.fieldErrors },
      400,
    );
  }

  // Bots that fill the hidden field get a normal-looking answer and nothing is stored.
  if (validation.honeypot) {
    return jsonResponse({ ok: true, reference: referenceFor(crypto.randomUUID()) }, 200);
  }

  const identity = await sessionIdentity();
  const value = {
    ...validation.value,
    email: validation.value.email ?? identity?.email?.toLowerCase() ?? null,
  };
  if (!hasContact(value)) {
    return jsonResponse(
      { ok: false, code: "invalid_fields", fieldErrors: { contact: "required" } },
      400,
    );
  }

  // Package orders are priced from the TAKATAK catalog, never from the browser.
  const pricedOrder = value.order
    ? priceMarketplaceOrder(value.order, await loadPublicCatalogRows())
    : null;
  if (value.kind === "package_order" && !pricedOrder) {
    return jsonResponse(
      { ok: false, code: "invalid_fields", fieldErrors: { package: "invalid" } },
      400,
    );
  }

  const prisma = getPrisma();
  if (!prisma) {
    return jsonResponse({ ok: false, code: "unavailable" }, 503);
  }

  try {
    const recorded = await recordWebsiteRequest(prisma, {
      clientId: config.clientId,
      request: value,
      authUserId: identity?.id ?? null,
      sourceHash,
      pricedOrder,
    });
    const notifyEmail = config.notifyEmail;
    if (notifyEmail && !recorded.duplicate) {
      // Sent after the response so the visitor never waits on email delivery.
      after(async () => {
        const status = await sendLeadAlert({
          to: notifyEmail,
          kind: value.kind,
          reference: recorded.reference,
          summary: recorded.summary,
          dashboardOrigin: getApplicationOrigin(),
        });
        if (status !== "sent") console.warn(`[website-requests] team alert ${status}`);
      });
    }
    return jsonResponse(
      {
        ok: true,
        reference: recorded.reference,
        ...(pricedOrder ? { totalCents: pricedOrder.totalCents } : {}),
        ...(value.kind === "project_request" && config.uploads
          ? {
              uploadToken: createUploadToken({
                secret: config.uploads.secret,
                leadId: recorded.leadId,
                clientId: config.clientId,
              }),
            }
          : {}),
      },
      200,
    );
  } catch (error) {
    if (error instanceof WebsiteLeadRateLimitedError) {
      return jsonResponse({ ok: false, code: "rate_limited" }, 429);
    }
    console.error(
      "[website-requests] intake failed:",
      redactSecrets(error instanceof Error ? error.message : "unknown_error"),
    );
    return jsonResponse({ ok: false, code: "unavailable" }, 503);
  }
}
