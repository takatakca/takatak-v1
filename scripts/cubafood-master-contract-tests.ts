import assert from "node:assert/strict";
import {
  CUBAFOOD_REQUEST_TTL_SECONDS,
  signCubafoodRequest,
  validateCubafoodEnvelope,
  verifyCubafoodSignature,
} from "../src/lib/integrations/cubafood/contract";

const payload = {
  schema_version: 1,
  source_application: "cubafood",
  event_id: "91a26ee4-3d6e-4796-a95d-d8cf46940527",
  event_type: "participant.registered",
  aggregate_type: "participant",
  source_tenant_ref: "project-canada-cuba",
  aggregate_ref: "participant-opaque-104",
  occurred_at: "2026-10-15T12:00:00Z",
};

const valid = validateCubafoodEnvelope(payload);
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.deepEqual(valid.event, payload);
}

for (const bad of [
  null,
  [],
  { ...payload, source_application: "1lv" },
  { ...payload, event_type: "order.paid" },
  { ...payload, event_type: "participant.registered", aggregate_type: "lead" },
  { ...payload, source_tenant_ref: "" },
  { ...payload, source_tenant_ref: "../other-tenant" },
  { ...payload, aggregate_ref: "x".repeat(161) },
  { ...payload, occurred_at: "not-a-date" },
  { ...payload, occurred_at: "2026-10-15T12:00:00-04:00" },
  { ...payload, event_id: "invalid-uuid" },
  { ...payload, email: "person@example.test" },
  { ...payload, phone: "+15550123456" },
  { ...payload, note: "private applicant details" },
  { ...payload, master_identity_id: "spoofed" },
  { ...payload, payment: { card: "xxxx" } },
  { ...payload, __proto__: undefined, secret: "do-not-accept" },
]) {
  assert.deepEqual(validateCubafoodEnvelope(bad), {
    ok: false,
    code: "invalid_event",
  });
}

const key = "fixture-only:" + "k".repeat(40);
const otherKey = "different-fixture-only:" + "z".repeat(40);
const nonce = "nonce_16_character_string_123";
const timestamp = "1792065600";
const rawBody = JSON.stringify(payload);
const signed = signCubafoodRequest(key, timestamp, nonce, rawBody);

const proof = verifyCubafoodSignature(
  { timestamp, nonce, signature: signed, rawBody },
  key,
  Number(timestamp),
);
assert.equal(proof.ok, true);
if (proof.ok) {
  assert.equal(proof.nonce, nonce);
  assert.equal(proof.timestamp, Number(timestamp));
  assert.match(proof.payloadHash, /^[a-f0-9]{64}$/);
}

assert.equal(
  verifyCubafoodSignature(
    { timestamp, nonce, signature: signed, rawBody: rawBody + " " },
    key, Number(timestamp),
  ).ok,
  false,
  "raw body changes must invalidate the signature",
);

assert.equal(
  verifyCubafoodSignature(
    { timestamp, nonce, signature: signed, rawBody },
    otherKey, Number(timestamp),
  ).ok,
  false,
  "a different product credential cannot authenticate a CUBAFOOD request",
);

assert.equal(
  verifyCubafoodSignature(
    { timestamp, nonce, signature: signed, rawBody },
    undefined, Number(timestamp),
  ).ok,
  false,
  "missing production secret must fail closed",
);

for (const now of [
  Number(timestamp) - CUBAFOOD_REQUEST_TTL_SECONDS - 1,
  Number(timestamp) + CUBAFOOD_REQUEST_TTL_SECONDS + 1,
]) {
  assert.equal(
    verifyCubafoodSignature(
      { timestamp, nonce, signature: signed, rawBody },
      key, now,
    ).ok,
    false,
    "stale and future signatures must be refused",
  );
}

assert.equal(
  verifyCubafoodSignature(
    { timestamp, nonce: "short", signature: signed, rawBody },
    key, Number(timestamp),
  ).ok,
  false,
);

assert.throws(
  () => signCubafoodRequest("short", timestamp, nonce, rawBody),
  /not configured/,
);

console.log("PASS CUBAFOOD contract validation, privacy and HMAC proof invariants");
