import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertMasterPayloadSafe } from "../src/lib/integrations/master-api/payload-safety";
import { MasterApiInputError } from "../src/lib/integrations/master-api/errors";
import { verifyMasterApiRequest } from "../src/lib/integrations/master-api/auth";

const key = "abcdefghijklmnopqrstuvwxyz0123456789ABCD";
process.env.TAKATAK_MASTER_API_KEY = key;

assert.equal(
  verifyMasterApiRequest(
    new Headers({ authorization: `Bearer ${key}` }),
  ).valid,
  true,
);
assert.equal(
  verifyMasterApiRequest(
    new Headers({ authorization: "Bearer wrong" }),
  ).valid,
  false,
);

assert.doesNotThrow(() =>
  assertMasterPayloadSafe({
    source_application: "1lv",
    local_profile_id: "user-1",
    email: "client@example.ca",
    shipping_address: { city: "Montréal", postal_code: "H1H1H1" },
  }),
);

for (const payload of [
  { password: "never" },
  { nested: { refresh_token: "never" } },
  { payment: { cardNumber: "4111111111111111" } },
  { auth: [{ sessionToken: "never" }] },
  { stripe_secret_key: "never" },
]) {
  assert.throws(
    () => assertMasterPayloadSafe(payload),
    MasterApiInputError,
  );
}

const events = readFileSync(
  resolve(process.cwd(), "src/lib/integrations/master-api/events.ts"),
  "utf8",
);
assert.match(
  events,
  /EXPECTED_AGGREGATE\[eventType\] !== aggregateType/,
  "Master event ingestion must bind each event type to its aggregate type.",
);
assert.match(
  events,
  /assertMasterPayloadSafe\(input\.payload\)/,
  "Master event ingestion must reject secret-bearing payloads.",
);

console.log("1LV master API safeguards: PASS");
