import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyMimtWebhook } from "../src/lib/integrations/mimt/verify-webhook";

const secret = "b".repeat(64);
const now = 1_790_000_000;
const body = JSON.stringify({
  id: "683a345a-99c5-4c9b-af1b-c941f7312cf5",
  type: "entitlement.updated",
  created_at: "2026-10-10T00:00:00.000Z",
  data: { telecom_account_id: "public-test" },
});
function sign(timestamp: number, content = body) {
  const hmac = createHmac("sha256", secret).update(String(timestamp) + "." + content).digest("hex");
  return "t=" + timestamp + ",v1=" + hmac;
}
assert.equal(verifyMimtWebhook(body, sign(now), secret, now), true, "signed current body");
assert.equal(verifyMimtWebhook(body, sign(now), "c".repeat(64), now), false, "wrong shared secret");
assert.equal(verifyMimtWebhook(body + " ", sign(now), secret, now), false, "exact raw body");
assert.equal(verifyMimtWebhook(body, sign(now - 301), secret, now), false, "expired signature");
assert.equal(verifyMimtWebhook(body, sign(now + 301), secret, now), false, "future signature");
assert.equal(verifyMimtWebhook(body, null, secret, now), false, "unsigned request");
assert.equal(verifyMimtWebhook(body, sign(now), undefined, now), false, "missing server secret");
assert.equal(verifyMimtWebhook(body, "t=bad,v1=x", secret, now), false, "malformed signature");
assert.equal(verifyMimtWebhook(body, sign(now), "short", now), false, "weak/invalid secret");
console.log("MIMT webhook signature tests passed");
