import assert from "node:assert/strict";
import { parseOneLvEvent } from "../src/lib/integrations/one-lv/parser";
import { verifyOneLvRequest } from "../src/lib/integrations/one-lv/auth";

const base = {
  event_id: "evt-1",
  event_type: "customer.created",
  aggregate_type: "customer",
  aggregate_id: "local-user-1",
  source_application: "1lv",
  payload: {
    source_application: "1lv",
    local_profile_id: "local-user-1",
    email: "client@example.ca",
    phone: "+15145550123",
  },
};

assert.equal(parseOneLvEvent(JSON.stringify(base)).valid, true);
assert.equal(
  parseOneLvEvent(JSON.stringify({ ...base, payload: { password: "never" } })).valid,
  false,
);
assert.equal(
  parseOneLvEvent(JSON.stringify({ ...base, source_application: "other" })).valid,
  false,
);
assert.equal(
  parseOneLvEvent(JSON.stringify({ ...base, event_type: "root.admin" })).valid,
  false,
);

process.env.TAKATAK_1LV_SYNC_ENABLED = "true";
const syntheticKey = Array.from({ length: 40 }, (_, index) => String.fromCharCode(97 + (index % 26))).join("");
process.env.TAKATAK_1LV_API_KEY = syntheticKey;

assert.equal(
  verifyOneLvRequest(new Headers({ authorization: `Bearer ${syntheticKey}` })).valid,
  true,
);
assert.equal(
  verifyOneLvRequest(new Headers({ authorization: "Bearer wrong" })).valid,
  false,
);

console.log("1LV master ingestion contract QA passed.");
