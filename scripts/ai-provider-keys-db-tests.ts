// AI provider keys against a real database (ephemeral CI Postgres or local).
// Synthetic keys only; refuses non-loopback databases. No provider is called:
// every key check runs against a fake fetch.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.GROWTH_TOKEN_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 11).toString("base64");

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  checkSavedProviderKey,
  listProviderKeys,
  removeProviderKey,
  resolveProviderKey,
  saveProviderKey,
  type CheckFetch,
} from "@/lib/ai-providers/store";

type Call = { url: string; headers: Record<string, string> };

function fakeFetch(status: number, calls: Call[], body: unknown = {}): CheckFetch {
  return (async (input: unknown, init?: { headers?: unknown }) => {
    const url = typeof input === "string" ? input : String((input as { url?: string }).url ?? input);
    const headers: Record<string, string> = {};
    new Headers((init?.headers ?? {}) as HeadersInit).forEach((value, key) => {
      headers[key] = value;
    });
    calls.push({ url, headers });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as CheckFetch;
}

const failingFetch: CheckFetch = async () => {
  throw new TypeError("fetch failed");
};

async function expectServiceError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof ServiceError && error.code === code);
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  const prisma = getPrisma()!;
  await prisma.aiProviderCredential.deleteMany({});
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const actor = await prisma.profile.create({ data: { authUserId: randomUUID(), email: `ai-keys-${randomUUID()}@example.test` } });

  const openaiKey = `sk-test-${randomUUID()}AB12`;
  await expectServiceError(saveProviderKey({ provider: "not_a_provider", apiKey: openaiKey, actorProfileId: actor.id }), "invalid_input");
  await expectServiceError(saveProviderKey({ provider: "openai", apiKey: "short", actorProfileId: actor.id }), "invalid_input");
  await saveProviderKey({ provider: "openai", apiKey: `  ${openaiKey}  `, actorProfileId: actor.id });
  const row = await prisma.aiProviderCredential.findUniqueOrThrow({ where: { provider: "openai" } });
  assert.equal(row.keyHint, "AB12");
  assert.ok(!row.ciphertext.includes(openaiKey) && !JSON.stringify(row).includes(openaiKey), "the key is never stored in clear");
  assert.equal(await resolveProviderKey("openai"), openaiKey, "the server can decrypt it for provider calls");
  const saveAudit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: row.id, action: "ai_provider_key.saved" } });
  assert.ok(!JSON.stringify(saveAudit).includes(openaiKey), "the audit log holds no key");
  assert.equal(saveAudit.profileId, actor.id);
  let views = await listProviderKeys();
  const openaiView = views.find((v) => v.key === "openai")!;
  assert.equal(openaiView.state, "saved_untested");
  assert.ok(!JSON.stringify(views).includes(openaiKey), "the page data holds no key");
  console.log("PASS a saved key is encrypted, shown only by its last four characters, audited without the key, and starts as not tested");

  const calls: Call[] = [];
  assert.equal(await checkSavedProviderKey({ provider: "openai", actorProfileId: actor.id, fetchImpl: fakeFetch(200, calls) }), "verified");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.openai.com/v1/models");
  assert.equal(calls[0].headers.authorization, `Bearer ${openaiKey}`);
  views = await listProviderKeys();
  assert.equal(views.find((v) => v.key === "openai")!.state, "verified");
  assert.equal(await checkSavedProviderKey({ provider: "openai", actorProfileId: actor.id, fetchImpl: fakeFetch(401, []) }), "rejected");
  views = await listProviderKeys();
  assert.equal(views.find((v) => v.key === "openai")!.state, "check_failed", "a refused key stops showing as working");
  assert.equal(await checkSavedProviderKey({ provider: "openai", actorProfileId: actor.id, fetchImpl: failingFetch }), "network_error");
  assert.equal(await checkSavedProviderKey({ provider: "openai", actorProfileId: actor.id, fetchImpl: fakeFetch(429, []) }), "rate_limited");
  const checks = await prisma.auditLog.count({ where: { entityId: row.id, action: "ai_provider_key.checked" } });
  assert.equal(checks, 4);
  console.log("PASS the test is a read-only request with the key in its header; only a 2xx marks the key as working, every result is audited");

  const claudeKey = `sk-ant-test-${randomUUID()}CD34`;
  await saveProviderKey({ provider: "anthropic", apiKey: claudeKey, actorProfileId: actor.id });
  const claudeCalls: Call[] = [];
  const modelsPage = { data: [], has_more: false, first_id: null, last_id: null };
  assert.equal(
    await checkSavedProviderKey({ provider: "anthropic", actorProfileId: actor.id, fetchImpl: fakeFetch(200, claudeCalls, modelsPage) }),
    "verified",
  );
  assert.equal(claudeCalls.length, 1);
  assert.match(claudeCalls[0].url, /^https:\/\/api\.anthropic\.com\/v1\/models/);
  assert.equal(claudeCalls[0].headers["x-api-key"], claudeKey);
  const unauthorized = { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } };
  assert.equal(
    await checkSavedProviderKey({ provider: "anthropic", actorProfileId: actor.id, fetchImpl: fakeFetch(401, [], unauthorized) }),
    "rejected",
  );
  assert.equal(await checkSavedProviderKey({ provider: "anthropic", actorProfileId: actor.id, fetchImpl: failingFetch }), "network_error");
  console.log("PASS Claude keys are checked with the official SDK's models list");

  await expectServiceError(checkSavedProviderKey({ provider: "revid", actorProfileId: actor.id, fetchImpl: fakeFetch(200, []) }), "invalid_input");
  await saveProviderKey({ provider: "revid", apiKey: `revid-${randomUUID()}`, actorProfileId: actor.id });
  views = await listProviderKeys();
  assert.equal(views.find((v) => v.key === "revid")!.state, "no_automatic_check", "never shown as working without a test");
  await expectServiceError(checkSavedProviderKey({ provider: "gemini", actorProfileId: actor.id, fetchImpl: fakeFetch(200, []) }), "not_found");
  console.log("PASS providers with no read-only endpoint are never marked as working; testing a missing key is refused");

  const replacement = `sk-test-${randomUUID()}EF56`;
  await saveProviderKey({ provider: "openai", apiKey: replacement, actorProfileId: actor.id });
  const replaced = await prisma.aiProviderCredential.findUniqueOrThrow({ where: { provider: "openai" } });
  assert.equal(replaced.id, row.id);
  assert.equal(replaced.keyHint, "EF56");
  assert.equal(replaced.lastCheckOutcome, null, "a new key must be tested again");
  assert.equal(await prisma.auditLog.count({ where: { entityId: row.id, action: "ai_provider_key.replaced" } }), 1);
  // A check that finishes after the key was replaced does not mark the new key.
  const raceFetch: CheckFetch = (async () => {
    await saveProviderKey({ provider: "openai", apiKey: `sk-test-${randomUUID()}GH78`, actorProfileId: actor.id });
    return new Response("{}", { status: 200 });
  }) as unknown as CheckFetch;
  await checkSavedProviderKey({ provider: "openai", actorProfileId: actor.id, fetchImpl: raceFetch });
  const afterRace = await prisma.aiProviderCredential.findUniqueOrThrow({ where: { provider: "openai" } });
  assert.equal(afterRace.keyHint, "GH78");
  assert.equal(afterRace.lastCheckOutcome, null, "the result of testing the old key is not applied to the new one");
  console.log("PASS replacing a key clears its test result; a test of the old key never marks the new one");

  // A row copied to another provider does not decrypt (the provider is bound in).
  const copied = await prisma.aiProviderCredential.findUniqueOrThrow({ where: { provider: "openai" } });
  await prisma.aiProviderCredential.create({
    data: { provider: "mistral", ciphertext: copied.ciphertext, iv: copied.iv, authTag: copied.authTag, keyVersion: copied.keyVersion, keyHint: copied.keyHint },
  });
  await assert.rejects(resolveProviderKey("mistral"), "a key moved to another provider fails to decrypt");
  await prisma.aiProviderCredential.delete({ where: { provider: "mistral" } });
  console.log("PASS a stored key only decrypts for its own provider");

  assert.equal(await removeProviderKey({ provider: "openai", actorProfileId: actor.id }), true);
  assert.equal(await removeProviderKey({ provider: "openai", actorProfileId: actor.id }), false);
  assert.equal(await resolveProviderKey("openai"), null);
  assert.equal(await prisma.auditLog.count({ where: { entityId: row.id, action: "ai_provider_key.removed" } }), 1);
  process.env.OPENAI_API_KEY = "sk-env-fallback-key-0000";
  assert.equal(await resolveProviderKey("openai"), "sk-env-fallback-key-0000", "with no saved key, the server variable is used");
  views = await listProviderKeys();
  assert.equal(views.find((v) => v.key === "openai")!.state, "env_only");
  delete process.env.OPENAI_API_KEY;
  console.log("PASS removing a key is audited; without a saved key the server variable is the fallback");

  await prisma.aiProviderCredential.deleteMany({});
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(String(e?.stack ?? e).slice(0, 1500));
    process.exit(1);
  },
);
