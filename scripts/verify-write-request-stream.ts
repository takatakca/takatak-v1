import assert from "node:assert/strict";
import type { NextRequest } from "next/server";

import {
  hasValidWriteOrigin,
  readJsonBody,
} from "../src/lib/security/write-request";

const origin = "https://takatak.ca";

function makeRequest(
  body: string | null,
  extraHeaders: Record<string, string> = {},
): NextRequest {
  const url = origin + "/api/dashboard/example";
  const request = new Request(url, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
    body,
  });
  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
    configurable: true,
  });
  return request as unknown as NextRequest;
}

async function verify(): Promise<void> {
  const accepted = await readJsonBody(makeRequest('{"id":"client-1"}'), 128);
  assert.deepEqual(accepted, { ok: true, body: { id: "client-1" } });

  const denied = await readJsonBody(makeRequest("{}", { Origin: "https://evil.test" }));
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.status, 403);
  assert.equal(hasValidWriteOrigin(makeRequest("{}")), true);

  const badMedia = await readJsonBody(makeRequest("{}", {
    "Content-Type": "text/plain; application/json",
  }));
  assert.equal(badMedia.ok, false);
  if (!badMedia.ok) assert.equal(badMedia.status, 415);

  const invalidJson = await readJsonBody(makeRequest("{bad json"));
  assert.equal(invalidJson.ok, false);
  if (!invalidJson.ok) assert.equal(invalidJson.status, 400);

  const overHeader = await readJsonBody(makeRequest("{}", {
    "Content-Length": "1000",
  }), 512);
  assert.equal(overHeader.ok, false);
  if (!overHeader.ok) assert.equal(overHeader.status, 413);

  for (const invalidLength of ["-1", "1.5", "not-a-number"]) {
    const result = await readJsonBody(makeRequest("{}", {
      "Content-Length": invalidLength,
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  }

  const tooLarge = JSON.stringify({ data: "x".repeat(1024) });
  const disguised = await readJsonBody(makeRequest(tooLarge, {
    "Content-Length": "2",
  }), 512);
  assert.equal(disguised.ok, false);
  if (!disguised.ok) assert.equal(disguised.status, 413);

  const unreported = await readJsonBody(makeRequest(tooLarge), 512);
  assert.equal(unreported.ok, false);
  if (!unreported.ok) assert.equal(unreported.status, 413);

  const exact = JSON.stringify({ data: "x".repeat(512 - 11) });
  assert.equal(Buffer.byteLength(exact, "utf8"), 512);
  const boundary = await readJsonBody(makeRequest(exact), 512);
  assert.equal(boundary.ok, true);

  const empty = await readJsonBody(makeRequest(null));
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.status, 400);

  console.log("PASS shared workspace JSON stream limits, origin and media type");
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
