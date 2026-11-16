import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { isCreativeIntelligenceCanaryEnabled } from "../src/lib/social/analytics/creative-intelligence-rollout";

const clientA = "123e4567-e89b-42d3-a456-426614174001";
const clientB = "123e4567-e89b-42d3-a456-426614174002";
const other = "123e4567-e89b-42d3-a456-426614174003";

const settings = { enabled: "true", clientIds: `${clientA}, ${clientB}` };
assert.equal(isCreativeIntelligenceCanaryEnabled(clientA, settings), true, "first client enabled");
assert.equal(isCreativeIntelligenceCanaryEnabled(clientB.toUpperCase(), settings), true, "canonical UUIDs are case insensitive");
assert.equal(isCreativeIntelligenceCanaryEnabled(other, settings), false, "other client must not receive canary");
assert.equal(isCreativeIntelligenceCanaryEnabled(clientA, { ...settings, enabled: "false" }), false);
assert.equal(isCreativeIntelligenceCanaryEnabled(clientA, { ...settings, enabled: undefined }), false);
assert.equal(isCreativeIntelligenceCanaryEnabled(clientA, { ...settings, clientIds: undefined }), false);
assert.equal(isCreativeIntelligenceCanaryEnabled(clientA, { ...settings, clientIds: "" }), false);
assert.equal(isCreativeIntelligenceCanaryEnabled(clientA, { ...settings, clientIds: "all" }), false);
assert.equal(isCreativeIntelligenceCanaryEnabled(clientA, { ...settings, clientIds: "*" }), false);
assert.equal(isCreativeIntelligenceCanaryEnabled(clientA, { ...settings, clientIds: `${clientA},` }), false, "malformed allowlist must fail closed");
assert.equal(isCreativeIntelligenceCanaryEnabled(clientA, { ...settings, clientIds: `${clientA},invalid` }), false, "bad UUID must fail closed");
assert.equal(isCreativeIntelligenceCanaryEnabled("other", settings), false);
assert.equal(isCreativeIntelligenceCanaryEnabled(clientA, { ...settings, clientIds: Array(51).fill(clientA).join(",") }), false);
assert.equal(isCreativeIntelligenceCanaryEnabled(clientA, { ...settings, clientIds: clientA.repeat(60) }), false);

const route = readFileSync("src/app/api/social/meta-ads/creatives/route.ts", "utf8");
const capability = readFileSync("src/app/api/social/meta-ads/creative-intelligence/capability/route.ts", "utf8");
const ui = readFileSync("src/components/social/platforms/meta-ads-subscribed-dashboard.tsx", "utf8");
const env = readFileSync(".env.example", "utf8");

assert(route.includes("isCreativeIntelligenceEnabledForClient(gate.access.activeClientId)"), "ad data is server gated");
assert(capability.includes('requireWorkspaceApiPermission("view_social")'), "capability requires workspace permission");
assert(capability.includes("isCreativeIntelligenceEnabledForClient(gate.access.activeClientId)"), "capability reads the signed workspace identity");
assert(capability.includes("resolveBrandSessionContextFromRequest"), "capability requires an active selected brand");
assert(!capability.includes("request.nextUrl.searchParams"), "browser cannot pick another client");
assert(capability.includes("jsonResponse({ ok: true, enabled: false }"), "disabled state is safe");
assert(ui.includes("creativeIntelligenceEnabled ? ("), "UI toggled only after server capability");
assert(ui.includes('cache: "no-store"'), "capability response is not cached by browser");
assert(!ui.includes("NEXT_PUBLIC_TAKATAK_CREATIVE_INTELLIGENCE_ENABLED"), "build-time flag cannot suppress a runtime canary");
assert(env.includes("TAKATAK_CREATIVE_INTELLIGENCE_ENABLED=false"), "server disabled by default");
assert(env.includes("TAKATAK_CREATIVE_INTELLIGENCE_CANARY_CLIENT_IDS="), "allowlist is explicit");
console.log("PASS Creative Intelligence runtime canary: fail-closed client UUID isolation and no compiled UI gate.");
