// AI provider keys — pure logic and static source checks. No database, no
// network, no provider call.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  AI_PROVIDER_CATALOG,
  buildCheckRequest,
  keyHint,
  normalizeApiKey,
  outcomeForStatus,
  providerEntry,
} from "../src/lib/ai-providers/catalog";
import { AI_PROVIDERS } from "../src/lib/growth/ai-engine";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

const keys = AI_PROVIDER_CATALOG.map((p) => p.key);
assert.equal(new Set(keys).size, keys.length, "provider keys are unique");
for (const key of keys) assert.match(key, /^[a-z0-9_]{2,40}$/, `${key} matches the database check`);
for (const growth of AI_PROVIDERS) {
  const entry = providerEntry(growth.key);
  assert.ok(entry, `Growth engine ${growth.key} has a key slot`);
  assert.equal(entry.env, growth.env, `${growth.key} keeps the Growth env variable`);
}
for (const key of ["twelvelabs", "revid", "suno", "lovable", "cursor"]) assert.ok(providerEntry(key), key);
assert.equal(providerEntry("github_models"), null, "GitHub Models was retired on 2026-07-30 and has no slot");
for (const key of ["suno", "lovable", "cursor"]) assert.equal(providerEntry(key)?.billableToClients, false, `${key} is not resold as credits`);
pass("every Growth engine plus the owner's extra providers has one slot; tools without a client API are not billable");

for (const entry of AI_PROVIDER_CATALOG) {
  if (entry.check.kind === "http") {
    const url = new URL(entry.check.url);
    assert.equal(url.protocol, "https:", `${entry.key} check is https`);
  }
  if (entry.check.kind === "none") assert.ok(entry.check.reason.length > 10, `${entry.key} says why it has no test`);
}
const secret = "fake-provider-key-0123456789WXYZ";
const openai = buildCheckRequest(providerEntry("openai")!, secret)!;
assert.equal(openai.url, "https://api.openai.com/v1/models");
assert.equal(openai.headers.Authorization, `Bearer ${secret}`);
const gemini = buildCheckRequest(providerEntry("gemini")!, secret)!;
assert.equal(gemini.headers["x-goog-api-key"], secret);
assert.equal(gemini.headers.Authorization, undefined);
assert.ok(!gemini.url.includes(secret), "the key never goes in a URL");
const runway = buildCheckRequest(providerEntry("runway")!, secret)!;
assert.equal(runway.headers["X-Runway-Version"], "2024-11-06");
for (const entry of AI_PROVIDER_CATALOG) {
  const request = buildCheckRequest(entry, secret);
  if (!request) continue;
  assert.ok(!request.url.includes(secret), `${entry.key}: key not in URL`);
  const carrying = Object.values(request.headers).filter((value) => value.includes(secret));
  assert.equal(carrying.length, 1, `${entry.key}: key in exactly one header`);
}
assert.equal(buildCheckRequest(providerEntry("revid")!, secret), null, "Revid's only calls spend credits");
assert.equal(buildCheckRequest(providerEntry("anthropic")!, secret), null, "Claude is checked through the official SDK");
pass("key checks are read-only https requests; the key goes in exactly one header, never in a URL");

assert.equal(outcomeForStatus(200), "verified");
assert.equal(outcomeForStatus(204), "verified");
assert.equal(outcomeForStatus(400), "rejected");
assert.equal(outcomeForStatus(401), "rejected");
assert.equal(outcomeForStatus(403), "rejected");
assert.equal(outcomeForStatus(429), "rate_limited");
assert.equal(outcomeForStatus(500), "provider_error");
assert.equal(outcomeForStatus(302), "provider_error");
pass("only a 2xx answer marks a key as working");

assert.deepEqual(normalizeApiKey(`  ${secret}\n`), { ok: true, key: secret });
for (const bad of [undefined, null, 42, "", "short", "has space inside the key value", `${secret}é`, "x".repeat(513)]) {
  assert.equal(normalizeApiKey(bad).ok, false, JSON.stringify(bad)?.slice(0, 40));
}
assert.equal(keyHint(secret), "WXYZ");
pass("pasted keys are trimmed and validated; only the last four characters are kept in clear");

const root = process.cwd();
const src = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const store = src("src/lib/ai-providers/store.ts");
assert.ok(store.startsWith('import "server-only";'), "the store is server-only");
assert.ok(store.includes("encryptGrowthValue(normalized.key, providerAad(entry.key))"), "keys are encrypted, bound to their provider");
assert.ok(!/console\.(log|error|warn)\([^)]*apiKey/.test(store), "keys are never logged");
const viewBlock = store.slice(store.indexOf("export interface ProviderKeyView"), store.indexOf("export function providerAad"));
assert.ok(!/ciphertext|apiKey|authTag/.test(viewBlock), "the page view carries no key material");
const auditMetadata = store.match(/metadata: \{[^}]*\}/g) ?? [];
assert.equal(auditMetadata.length, 3, "save, remove and test each write one audit entry");
for (const block of auditMetadata) assert.ok(!/apiKey|normalized\.key|ciphertext/.test(block), `audit metadata holds no key: ${block}`);

const page = src("src/app/dashboard/admin/ai-providers/page.tsx");
assert.ok(page.includes("requireAdminAccess()"), "the page needs platform admin access");
assert.ok(!/resolveProviderKey|decryptGrowthValue/.test(page), "the page never decrypts a key");
const actions = src("src/app/dashboard/admin/ai-providers/actions.ts");
assert.ok(actions.startsWith('"use server";'));
assert.equal((actions.match(/await requireWriter\(\)/g) ?? []).length, 3, "every action needs a signed-in platform owner/admin");
assert.ok(actions.includes('access.mode !== "authorized"'), "the foundation demo cannot write keys");
const row = src("src/components/admin/ai-provider-key-row.tsx");
assert.ok(row.includes('type="password"') && row.includes('autoComplete="off"'), "the key field is masked and not autofilled");

const migration = src("prisma/migrations/20261009100000_ai_provider_credentials/migration.sql");
assert.ok(migration.includes('ALTER TABLE "ai_provider_credentials" ENABLE ROW LEVEL SECURITY'));
assert.ok(migration.includes("REVOKE ALL ON TABLE \"ai_provider_credentials\""));
assert.ok(src("scripts/ci-rls-advisor-catalog.ts").includes('"ai_provider_credentials"'), "listed as a secret table");
assert.ok(fs.existsSync(path.join(root, "scripts/rollback/ai-provider-credentials-down.sql")));
pass("server-only store, admin-only page and actions, masked input, RLS on, no browser grants, rollback present");

console.log("\nAI PROVIDER KEYS SAFEGUARDS: ALL PASSED");
