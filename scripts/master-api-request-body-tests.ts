import assert from "node:assert/strict";

import { readMasterJson, MASTER_API_MAX_BODY_BYTES } from "../src/lib/integrations/master-api/http";
import { MasterApiInputError } from "../src/lib/integrations/master-api/errors";

const endpoint = "https://takatak.ca/api/v1/events";

function jsonRequest(
  data: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(endpoint, {
    method: "POST",
    body: data,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

async function rejectsInput(request: Request, message: RegExp) {
  await assert.rejects(
    () => readMasterJson(request),
    (error: unknown) =>
      error instanceof MasterApiInputError &&
      message.test(error.message),
  );
}

async function verify(): Promise<void> {
  const rawBody = JSON.stringify({
    source_application: "1lv",
    event_id: "91a26ee4-3d6e-4796-a95d-d8cf46940527",
  });
  const parsed = await readMasterJson(jsonRequest(rawBody));
  assert.equal(parsed.rawBody, rawBody, "raw JSON must be retained for event idempotency hash");
  assert.deepEqual(parsed.body, JSON.parse(rawBody));

  await rejectsInput(
    jsonRequest("{}", { "Content-Type": "text/plain; application/json" }),
    /Content-Type/,
  );
  await rejectsInput(
    jsonRequest("{}", { "Content-Type": "application/jsonp" }),
    /Content-Type/,
  );
  await rejectsInput(jsonRequest("[]"), /JSON object required/);
  await rejectsInput(jsonRequest("{not-json"), /Invalid JSON/);
  await rejectsInput(jsonRequest("null"), /JSON object required/);
  await rejectsInput(jsonRequest("{}", { "Content-Length": "-1" }), /Invalid Content-Length/);
  await rejectsInput(jsonRequest("{}", { "Content-Length": "1.5" }), /Invalid Content-Length/);
  await rejectsInput(
    jsonRequest("{}", { "Content-Length": String(MASTER_API_MAX_BODY_BYTES + 1) }),
    /Payload too large/,
  );
  await rejectsInput(
    jsonRequest(JSON.stringify({ data: "x".repeat(MASTER_API_MAX_BODY_BYTES) }), {
      "Content-Length": "2",
    }),
    /Payload too large/,
  );
  await rejectsInput(
    jsonRequest(JSON.stringify({ data: "x".repeat(MASTER_API_MAX_BODY_BYTES) })),
    /Payload too large/,
  );

  // Exact boundary remains accepted, even if the client omits Content-Length.
  const exactBody = JSON.stringify({ data: "x".repeat(MASTER_API_MAX_BODY_BYTES - 11) });
  assert.equal(Buffer.byteLength(exactBody, "utf8"), MASTER_API_MAX_BODY_BYTES);
  const boundary = await readMasterJson(jsonRequest(exactBody));
  assert.equal(boundary.rawBody.length, MASTER_API_MAX_BODY_BYTES);

  console.log("PASS master API JSON stream boundary and malformed-body checks");
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
