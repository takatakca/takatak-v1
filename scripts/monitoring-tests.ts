import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { monitoringDomainWhere, monitoringEntitled, reportCsv, snapshotSchema, snapshotState, verifySnapshotSignature } from "../src/lib/monitoring/policy";
import { sanitizeNextPath } from "../src/lib/security/safe-redirect";
import { readBoundedText } from "../src/lib/http/read-bounded-text";

const now = 1793592000000;
const id = "a1111111-1111-4111-8111-111111111111";
const sample = { domainAssetId: id, hostname: "example.com", observedAt: now / 1000, intervalSeconds: 300,
  stable: "up" as const, ok: true, status: 200, latencyMs: 20, reason: "http" as const,
  months: [{ month: "2026-11", checks: 4, successes: 3, meanMs: 20 }] };
const secret = "1a".repeat(32), timestamp = String(now / 1000), raw = JSON.stringify(sample);
const signature = createHmac("sha256", Buffer.from(secret, "hex")).update(`${timestamp}.${raw}`).digest("hex");
assert.equal(verifySnapshotSignature(raw, timestamp, signature, secret, now), true);
assert.equal(verifySnapshotSignature(raw + " ", timestamp, signature, secret, now), false);
assert.equal(verifySnapshotSignature(raw, timestamp, signature, "1b".repeat(32), now), false);
assert.equal(verifySnapshotSignature(raw, timestamp, signature, secret, now + 301000), false);
for (const invalid of [null, "a", "f".repeat(62), "g".repeat(64)]) assert.equal(verifySnapshotSignature(raw, timestamp, invalid, secret, now), false);
assert.equal(snapshotState(sample, now), "up");
assert.equal(snapshotState(sample, now + 901000), "stale");
assert.equal(snapshotState(null, now), "awaiting_check");
assert.equal(snapshotSchema.safeParse({ ...sample, months: [{ ...sample.months[0], successes: 5 }] }).success, false);
assert.equal(snapshotSchema.safeParse({ ...sample, clientId: id }).success, false);
assert.equal(snapshotSchema.safeParse({ ...sample, hostname: "=evil.example" }).success, false);
assert.equal(snapshotSchema.safeParse({ ...sample, months: [sample.months[0], sample.months[0]] }).success, false);
assert.equal(monitoringEntitled({ status: "active", paidUntil: now / 1000 + 100 }, now), true);
for (const status of ["incomplete", "past_due", "trialing", "canceled", "unpaid"]) assert.equal(monitoringEntitled({ status, paidUntil: now / 1000 + 100 }, now), false);
assert.equal(monitoringEntitled({ status: "active", paidUntil: now / 1000 - 1 }, now), false);
assert.equal(monitoringEntitled({ status: "active" }, now), false);
assert.deepEqual(monitoringDomainWhere(id, id), { clientId: id, id });
assert.throws(() => monitoringDomainWhere("", id));
const csv = reportCsv([{ hostname: "example.com", snapshot: sample }, { hostname: "missing.example.com", snapshot: null }], "2026-11");
assert.match(csv, /example.com,4,3,75.000,20/);
assert.match(csv, /missing.example.com,0,0,,/);
assert.throws(() => reportCsv([], "2026-99"));
assert.equal(sanitizeNextPath("/dashboard/web-hosting/monitoring"), "/dashboard/web-hosting/monitoring");
assert.equal(sanitizeNextPath("//evil.example"), "/dashboard");
const tooLarge = new Request("https://example.com", { method: "POST", body: "a".repeat(8193) });
async function main() {
  assert.equal(await readBoundedText(tooLarge, 8192), null);
  console.log("PASS monitoring signatures, tamper/stale rejection, billing states, scope filters, honest CSV, signup return paths and streamed body limit");
}
void main();
