import assert from "node:assert/strict";

import {
  readPublicAdsJson,
  sanitizePublicAdsContext,
} from "../src/lib/ads/public-request";

function jsonRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://takatak.ca/api/ads/serve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
    body,
  });
}

async function run(): Promise<void> {
  const valid = await readPublicAdsJson(jsonRequest(JSON.stringify({
    publisherCode: "ahmv",
    placementCode: "home-hero-01",
  })));
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.body.publisherCode, "ahmv");

  const wrongMediaType = await readPublicAdsJson(new Request(
    "https://takatak.ca/api/ads/serve",
    { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" },
  ));
  assert.equal(wrongMediaType.ok, false);
  if (!wrongMediaType.ok) assert.equal(wrongMediaType.status, 415);

  const invalidJson = await readPublicAdsJson(jsonRequest("{broken"));
  assert.equal(invalidJson.ok, false);
  if (!invalidJson.ok) assert.equal(invalidJson.status, 400);

  const arrayBody = await readPublicAdsJson(jsonRequest("[]"));
  assert.equal(arrayBody.ok, false);
  if (!arrayBody.ok) assert.equal(arrayBody.status, 400);

  const declaredOversize = await readPublicAdsJson(jsonRequest("{}", {
    "Content-Length": "9000",
  }));
  assert.equal(declaredOversize.ok, false);
  if (!declaredOversize.ok) assert.equal(declaredOversize.status, 413);

  const forgedSmallLength = await readPublicAdsJson(jsonRequest(
    JSON.stringify({ data: "x".repeat(6000) }),
    { "Content-Length": "2" },
  ));
  assert.equal(forgedSmallLength.ok, false);
  if (!forgedSmallLength.ok) assert.equal(forgedSmallLength.status, 413);

  const invalidLength = await readPublicAdsJson(jsonRequest("{}", {
    "Content-Length": "-1",
  }));
  assert.equal(invalidLength.ok, false);
  if (!invalidLength.ok) assert.equal(invalidLength.status, 400);

  const safeContext = sanitizePublicAdsContext({
    country: " Canada ",
    region: "Québec",
    city: "Verdun",
    postalPrefix: "H4G 2T8",
    device: "tablet",
    email: "someone@example.test",
    ipAddress: "127.0.0.1",
    fingerprint: "privacy",
    location: { latitude: 45.5 },
    locale: ["fr"],
    category: { nested: "not-accepted" },
  });

  assert.deepEqual(safeContext, {
    country: "Canada",
    region: "Québec",
    city: "Verdun",
    postalPrefix: "H4G",
    device: "tablet",
  });

  const invalidContext = sanitizePublicAdsContext({
    country: 42,
    device: "fingerprint",
    postalPrefix: "???",
    city: "",
  });
  assert.deepEqual(invalidContext, {});

  assert.equal(sanitizePublicAdsContext(["tracking"]), undefined);
  console.log("PASS ADS public JSON size, media type and context privacy checks");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
