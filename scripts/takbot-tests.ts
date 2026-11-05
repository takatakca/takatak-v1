import assert from "node:assert/strict";

import { TAKBOT_ENGINES, TAKBOT_MODES, creditsFor, routeTakbotRequest, takbotEngine } from "../src/lib/takbot/catalog";
import { modelFor, readRelayText, relayPrompt } from "../src/lib/takbot/relay";

// Every mode has a real credit action, and every engine comes from the billable catalog.
for (const mode of TAKBOT_MODES) assert.ok(creditsFor(mode) > 0, `mode ${mode.key} has a credit cost`);
assert.ok(TAKBOT_ENGINES.length >= 8, "engines come from the provider catalog");
assert.equal(takbotEngine("suno"), null, "non-billable tools are never offered");
assert.equal(takbotEngine("lovable"), null);

// Auto picks the first connected engine in the mode's preference order.
const auto = routeTakbotRequest({ mode: "chat", engine: "auto", connected: new Set(["openai", "mistral"]) });
assert.ok(auto.ok && auto.engine.key === "openai" && auto.auto);
const anthropicFirst = routeTakbotRequest({ mode: "chat", engine: "auto", connected: new Set(["openai", "anthropic"]) });
assert.ok(anthropicFirst.ok && anthropicFirst.engine.key === "anthropic");

// Nothing connected, unknown or mismatched engines, and studio-only modes are refused.
assert.deepEqual(routeTakbotRequest({ mode: "chat", engine: "auto", connected: new Set() }), { ok: false, code: "no_engine_connected" });
assert.deepEqual(routeTakbotRequest({ mode: "nope", engine: "auto", connected: new Set(["openai"]) }), { ok: false, code: "unknown_mode" });
assert.deepEqual(routeTakbotRequest({ mode: "chat", engine: "nope", connected: new Set(["openai"]) }), { ok: false, code: "unknown_engine" });
assert.deepEqual(routeTakbotRequest({ mode: "chat", engine: "elevenlabs", connected: new Set(["elevenlabs"]) }), { ok: false, code: "engine_mode_mismatch" });
assert.deepEqual(routeTakbotRequest({ mode: "video", engine: "auto", connected: new Set(["runway"]) }), { ok: false, code: "mode_not_inline" });
assert.deepEqual(routeTakbotRequest({ mode: "chat", engine: "openai", connected: new Set() }), { ok: false, code: "no_engine_connected" });

// Response parsing per provider shape.
const openai = takbotEngine("openai")!;
const anthropic = takbotEngine("anthropic")!;
const gemini = takbotEngine("gemini")!;
assert.equal(readRelayText(openai, { choices: [{ message: { content: " Bonjour " } }] }), "Bonjour");
assert.equal(readRelayText(anthropic, { content: [{ type: "text", text: "Hi" }, { type: "tool_use" }] }), "Hi");
assert.equal(readRelayText(gemini, { candidates: [{ content: { parts: [{ text: "Salut" }] } }] }), "Salut");
assert.equal(modelFor(openai, { TAKBOT_MODEL_OPENAI: "custom-model" }), "custom-model");

async function main() {
  // The key goes only to the provider, and provider errors become short codes.
  let seen: { url: string; headers: Record<string, string> } | null = null;
  const ok = await relayPrompt({ engine: anthropic, mode: "chat", apiKey: "k-test", prompt: "hello" }, async (url, init) => {
    seen = { url, headers: init.headers as Record<string, string> };
    return new Response(JSON.stringify({ content: [{ type: "text", text: "yo" }] }), { status: 200 });
  });
  assert.ok(ok.ok);
  assert.equal(ok.text, "yo");
  assert.equal(ok.model, modelFor(anthropic));
  assert.equal(ok.usage.inputTokens, null, "missing provider usage is unknown");
  assert.equal(seen!.url, "https://api.anthropic.com/v1/messages");
  assert.equal(seen!.headers["x-api-key"], "k-test");

  const limited = await relayPrompt({ engine: openai, mode: "write", apiKey: "k", prompt: "x" }, async () => new Response("{}", { status: 429 }));
  assert.deepEqual(limited, { ok: false, code: "rate_limited" });
  const empty = await relayPrompt({ engine: openai, mode: "write", apiKey: "k", prompt: "x" }, async () => new Response("{}", { status: 200 }));
  assert.deepEqual(empty, { ok: false, code: "empty" });
  const down = await relayPrompt({ engine: gemini, mode: "chat", apiKey: "k", prompt: "x" }, async () => {
    throw new TypeError("fetch failed");
  });
  assert.deepEqual(down, { ok: false, code: "network" });

  // Ollama Cloud: an OpenAI-compatible open-model engine, offered to every workspace once its key is saved.
  const ollama = takbotEngine("ollama")!;
  assert.ok(ollama, "Ollama Cloud is a TAK-TAK engine");
  assert.equal(ollama.relay, "openai_compat");
  assert.equal(ollama.endpoint, "https://ollama.com/v1/chat/completions");
  assert.ok(ollama.modes.includes("chat") && ollama.modes.includes("write"));
  assert.equal(modelFor(ollama, {}), "gpt-oss:120b");
  assert.equal(modelFor(ollama, { TAKBOT_MODEL_OLLAMA: "kimi-k2.7-code" }), "kimi-k2.7-code");
  const ollamaAuto = routeTakbotRequest({ mode: "chat", engine: "auto", connected: new Set(["ollama", "deepseek"]) });
  assert.ok(ollamaAuto.ok && ollamaAuto.engine.key === "ollama", "auto prefers Ollama over DeepSeek");
  const ollamaPicked = routeTakbotRequest({ mode: "write", engine: "ollama", connected: new Set(["ollama"]) });
  assert.ok(ollamaPicked.ok && ollamaPicked.engine.key === "ollama");
  let ollamaCall: { url: string; auth: string; model: string } | null = null;
  const ollamaRun = await relayPrompt({ engine: ollama, mode: "chat", apiKey: "ok-test", prompt: "Bonjour" }, async (url, init) => {
    const headers = init.headers as Record<string, string>;
    ollamaCall = { url, auth: headers.Authorization, model: JSON.parse(String(init.body)).model };
    return new Response(JSON.stringify({ choices: [{ message: { content: "Salut !" } }] }), { status: 200 });
  }, {});
  assert.ok(ollamaRun.ok);
  assert.equal(ollamaRun.text, "Salut !");
  assert.equal(ollamaRun.model, "gpt-oss:120b");
  assert.deepEqual(ollamaCall, { url: "https://ollama.com/v1/chat/completions", auth: "Bearer ok-test", model: "gpt-oss:120b" });
  const ollamaDenied = await relayPrompt({ engine: ollama, mode: "chat", apiKey: "bad", prompt: "x" }, async () => new Response("{}", { status: 401 }), {});
  assert.deepEqual(ollamaDenied, { ok: false, code: "auth" });

  console.log("takbot tests: OK");
}

void main();
