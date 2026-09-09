import { createHmac } from "node:crypto";

import { verifyUpmindWebhook } from "../src/lib/integrations/upmind/webhook";
import {
  domainStatusForHook,
  extractDomainName,
  extractUpmindClientId,
  isLikelyDomainName,
  parseUpmindWebhookPayload,
  webhookAppliesToDomain,
} from "../src/lib/integrations/upmind/webhook-payload";

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

const SECRET = "test-webhook-secret";
process.env.UPMIND_WEBHOOK_SECRET = SECRET;
process.env.UPMIND_WEBHOOK_ENABLED = "true";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

const contractBody = JSON.stringify({
  webhook_event_id: "evt-1",
  hook_category: "contract_product",
  hook_code: "contract_product_activated_hook",
  object_type: "contract_product",
  object_id: "prod-1",
  object: {
    id: "prod-1",
    client_id: "upmind-client-9",
    domain: "shop.example.com",
    auto_renew: true,
    expiry_date: "2027-08-01 00:00:00",
  },
});

function main() {
  console.log("[upmind-webhook] signature + payload tests");

  const verified = verifyUpmindWebhook(
    contractBody,
    new Headers({ "X-Webhook-Signature": sign(contractBody) }),
  );
  assert("valid signature is trusted", verified.trusted && verified.state === "verified");

  const bad = verifyUpmindWebhook(
    contractBody,
    new Headers({ "X-Webhook-Signature": "00".repeat(32) }),
  );
  assert("wrong signature is rejected", !bad.trusted && bad.state === "invalid_signature");

  const missing = verifyUpmindWebhook(contractBody, new Headers());
  assert("missing signature is rejected", !missing.trusted && missing.state === "invalid_signature");

  process.env.UPMIND_WEBHOOK_ENABLED = "false";
  const disabled = verifyUpmindWebhook(
    contractBody,
    new Headers({ "X-Webhook-Signature": sign(contractBody) }),
  );
  assert("disabled flag skips verification", disabled.state === "disabled" && !disabled.trusted);
  process.env.UPMIND_WEBHOOK_ENABLED = "true";

  const envelope = parseUpmindWebhookPayload(contractBody);
  assert("parses V1 envelope", Boolean(envelope));
  assert(
    "extracts domain",
    envelope ? extractDomainName(envelope) === "shop.example.com" : false,
  );
  assert(
    "extracts Upmind client id",
    envelope ? extractUpmindClientId(envelope) === "upmind-client-9" : false,
  );
  assert(
    "activated hook applies and maps to tracked",
    Boolean(envelope && webhookAppliesToDomain(envelope)) &&
      domainStatusForHook("contract_product_activated_hook") === "tracked",
  );

  const clientOnly = parseUpmindWebhookPayload(
    JSON.stringify({
      webhook_event_id: "evt-2",
      hook_category: "client",
      hook_code: "client_registered_hook",
      object_type: "client",
      object: { id: "upmind-client-9", email: "owner@example.com" },
    }),
  );
  assert(
    "client registered does not apply a domain row",
    Boolean(clientOnly && !webhookAppliesToDomain(clientOnly) && !extractDomainName(clientOnly)),
  );

  assert("rejects emails as domains", !isLikelyDomainName("owner@example.com"));
  assert("rejects .local hostnames", !isLikelyDomainName("brand.upmind.local"));

  const named = parseUpmindWebhookPayload(
    JSON.stringify({
      hook_category: "invoice",
      hook_code: "invoice_paid_hook",
      object: { client_id: "c1", name: "Domain registration for studio.takatak.ca" },
    }),
  );
  assert(
    "pulls a domain out of an invoice name",
    named ? extractDomainName(named) === "studio.takatak.ca" : false,
  );

  if (failed) {
    console.error(`[upmind-webhook] ${failed} failed`);
    process.exit(1);
  }
  console.log("[upmind-webhook] all checks passed");
}

main();
