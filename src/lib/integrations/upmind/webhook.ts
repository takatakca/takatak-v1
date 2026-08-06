// Phase 8 — Upmind webhook verification SKELETON.
//
// IMPORTANT: Final signature verification MUST match official Upmind
// documentation (header name, algorithm, encoding) before ANY event is
// trusted. Until those rules are confirmed, verification returns
// "configured_untested" and events are NEVER trusted — there is no fake
// "valid" signature rule anywhere in this file.
import "server-only";
import { getUpmindEnvStatus } from "./env";
import type { UpmindWebhookVerificationResult } from "./types";

export function verifyUpmindWebhook(
  rawBody: string,
  headers: Headers,
): UpmindWebhookVerificationResult {
  // Reserved for the confirmed signature check (raw body + header lookup).
  void rawBody;
  void headers;
  const env = getUpmindEnvStatus();
  if (!env.webhookEnabled) {
    return { state: "disabled", trusted: false, message: "Upmind webhooks are disabled (UPMIND_WEBHOOK_ENABLED is not true)." };
  }
  if (!env.hasWebhookSecret) {
    return { state: "not_configured", trusted: false, message: "Webhook secret is not configured (UPMIND_WEBHOOK_SECRET missing)." };
  }
  // Secret exists, but the official signature scheme is not yet confirmed.
  // TODO(Phase 8+): implement HMAC verification per official Upmind docs
  // (confirm header name + algorithm), compare with timing-safe equality,
  // and only then return a trusted result.
  return {
    state: "configured_untested",
    trusted: false,
    message:
      "Webhook secret detected, but signature verification rules are not confirmed from official Upmind docs. Event NOT trusted.",
  };
}
