// AI Studio live generation — config, prompts, provider adapters and the
// draft-only service (no network, no DB). Run: npm run qa:ai-studio-generation
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DEFAULT_ANTHROPIC_MODEL, readAiStudioConfig } from "../src/lib/ai/generation/config";
import { buildPrompt, parseGenerateRequest, type GenerateRequest } from "../src/lib/ai/generation/prompt";
import { callProvider, MAX_OUTPUT_TOKENS } from "../src/lib/ai/generation/provider-call";
import { dbProvider, generateForWorkspace, GENERATION_SOURCE, type GenerationDb } from "../src/lib/ai/generation/service";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const VOICE = "33333333-3333-4333-8333-333333333333";
const KEY = "sk-test-0123456789abcdefghij";

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const baseRequest: GenerateRequest = {
  kind: "caption",
  platform: "Instagram",
  language: "fr",
  goal: "Promouvoir le spécial du midi",
  context: "Soupe + sandwich 14,95 $",
  brandVoiceId: null,
};

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function main() {
  console.log("AI Studio generation checks");

  await check("generation is off unless enabled with a key and an explicit model", () => {
    assert.deepEqual(readAiStudioConfig({}), { enabled: false, reason: "disabled" });
    assert.deepEqual(readAiStudioConfig({ AI_STUDIO_GENERATION_ENABLED: "true" }), { enabled: false, reason: "missing_key" });
    assert.deepEqual(readAiStudioConfig({ AI_STUDIO_GENERATION_ENABLED: "true", AI_STUDIO_PROVIDER: "gemini", OPENAI_API_KEY: KEY }), { enabled: false, reason: "invalid_provider" });
    assert.deepEqual(readAiStudioConfig({ AI_STUDIO_GENERATION_ENABLED: "true", OPENAI_API_KEY: KEY }), { enabled: false, reason: "missing_model" });
    const openai = readAiStudioConfig({ AI_STUDIO_GENERATION_ENABLED: "true", OPENAI_API_KEY: KEY, AI_STUDIO_OPENAI_MODEL: "gpt-test", AI_STUDIO_DAILY_LIMIT: "5000" });
    assert.ok(openai.enabled && openai.provider === "openai" && openai.model === "gpt-test" && openai.dailyLimit === 50);
    const claude = readAiStudioConfig({ AI_STUDIO_GENERATION_ENABLED: "true", AI_STUDIO_PROVIDER: "anthropic", ANTHROPIC_API_KEY: KEY, AI_STUDIO_DAILY_LIMIT: "10" });
    assert.ok(claude.enabled && claude.model === DEFAULT_ANTHROPIC_MODEL && claude.dailyLimit === 10);
    assert.deepEqual(readAiStudioConfig({ AI_STUDIO_GENERATION_ENABLED: "true", AI_STUDIO_PROVIDER: "anthropic", ANTHROPIC_API_KEY: KEY, AI_STUDIO_ANTHROPIC_MODEL: "bad model!" }), { enabled: false, reason: "missing_model" });
  });

  await check("requests are whitelisted and bounded", () => {
    assert.ok(parseGenerateRequest({ kind: "caption", platform: "Instagram", goal: "Lunch special", language: "fr" }));
    assert.equal(parseGenerateRequest({ kind: "caption", platform: "Instagram", goal: "x" })?.language, "en");
    for (const bad of [
      null, { kind: "essay", platform: "Instagram", goal: "x" }, { kind: "caption", platform: "MySpace", goal: "x" },
      { kind: "caption", platform: "Instagram", goal: "" }, { kind: "caption", platform: "Instagram", goal: "x".repeat(501) },
      { kind: "caption", platform: "Instagram", goal: "x", context: "y".repeat(2001) },
      { kind: "caption", platform: "Instagram", goal: "x", brandVoiceId: "not-a-uuid" },
      { kind: "toString", platform: "Instagram", goal: "x" },
    ]) {
      assert.equal(parseGenerateRequest(bad), null, JSON.stringify(bad));
    }
  });

  await check("prompts apply language, platform, brand voice and the no-invention rule", () => {
    const withVoice = buildPrompt(baseRequest, {
      name: "Bistro", tone: "chaleureux", audience: "travailleurs du quartier",
      keywords: ["frais"], bannedPhrases: ["meilleur en ville"], sampleCaption: null, notes: null,
    });
    assert.match(withVoice.system, /Canadian French/);
    assert.match(withVoice.system, /Platform: Instagram/);
    assert.match(withVoice.system, /Never invent prices/);
    assert.match(withVoice.system, /Never use: meilleur en ville/);
    assert.match(withVoice.user, /Promouvoir le spécial du midi/);
    assert.match(withVoice.user, /14,95 \$/);
    assert.doesNotMatch(buildPrompt({ ...baseRequest, language: "en" }, null).system, /Brand voice/);
  });

  await check("OpenAI and Anthropic adapters call fixed endpoints with bounded output", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (reply: Response) => async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return reply;
    };
    const prompt = { system: "S", user: "U" };

    const openai = await callProvider({ provider: "openai", apiKey: KEY, model: "gpt-test" }, prompt,
      fakeFetch(response(200, { choices: [{ message: { content: "  Bonjour!  " } }], usage: { prompt_tokens: 12, completion_tokens: 3 } })));
    assert.deepEqual(openai, { ok: true, text: "Bonjour!", inputTokens: 12, outputTokens: 3 });
    assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, `Bearer ${KEY}`);
    assert.equal(calls[0].init.redirect, "error");
    const openaiBody = JSON.parse(String(calls[0].init.body));
    assert.equal(openaiBody.model, "gpt-test");
    assert.equal(openaiBody.max_completion_tokens, MAX_OUTPUT_TOKENS);
    assert.deepEqual(openaiBody.messages.map((m: { role: string }) => m.role), ["system", "user"]);

    const claude = await callProvider({ provider: "anthropic", apiKey: KEY, model: "claude-test" }, prompt,
      fakeFetch(response(200, { content: [{ type: "text", text: "Salut" }, { type: "text", text: " !" }], usage: { input_tokens: 9, output_tokens: 2 } })));
    assert.deepEqual(claude, { ok: true, text: "Salut !", inputTokens: 9, outputTokens: 2 });
    assert.equal(calls[1].url, "https://api.anthropic.com/v1/messages");
    const headers = calls[1].init.headers as Record<string, string>;
    assert.equal(headers["x-api-key"], KEY);
    assert.equal(headers["anthropic-version"], "2023-06-01");
    const claudeBody = JSON.parse(String(calls[1].init.body));
    assert.equal(claudeBody.system, "S");
    assert.equal(claudeBody.max_tokens, MAX_OUTPUT_TOKENS);
  });

  await check("provider failures become short codes without provider text", async () => {
    const cfg = { provider: "openai" as const, apiKey: KEY, model: "gpt-test" };
    const p = { system: "S", user: "U" };
    const reply = (r: Response) => async () => r;
    assert.deepEqual(await callProvider(cfg, p, reply(response(401, { error: { message: "secret detail" } }))), { ok: false, code: "auth" });
    assert.deepEqual(await callProvider(cfg, p, reply(response(429, {}))), { ok: false, code: "rate_limited" });
    assert.deepEqual(await callProvider(cfg, p, reply(response(500, {}))), { ok: false, code: "provider_error" });
    assert.deepEqual(await callProvider(cfg, p, reply(response(200, { choices: [] }))), { ok: false, code: "empty" });
    assert.deepEqual(await callProvider(cfg, p, reply(new Response("not json", { status: 200 }))), { ok: false, code: "provider_error" });
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    assert.deepEqual(await callProvider(cfg, p, async () => { throw timeout; }), { ok: false, code: "timeout" });
    assert.deepEqual(await callProvider(cfg, p, async () => { throw new Error("ECONNRESET"); }), { ok: false, code: "network" });
  });

  type Row = Record<string, unknown>;
  function fakeDb(options: { jobsToday?: number; voiceClient?: string } = {}) {
    const jobs: Row[] = [];
    const outputs: Row[] = [];
    const events: Row[] = [];
    let countWhere: Row | null = null;
    const db = {
      aiContentJob: {
        async count({ where }: { where: Row }) { countWhere = where; return options.jobsToday ?? 0; },
        async create({ data }: { data: Row }) { const row = { ...data, id: `job-${jobs.length + 1}` }; jobs.push(row); return { id: row.id }; },
        async update({ where, data }: { where: { id: string }; data: Row }) { Object.assign(jobs.find((j) => j.id === where.id)!, data); return {}; },
      },
      brandVoice: {
        async findFirst({ where }: { where: { id: string; clientId: string } }) {
          return where.id === VOICE && where.clientId === (options.voiceClient ?? CLIENT)
            ? { id: VOICE, businessBrandId: null, name: "Bistro", tone: "warm", audience: null, keywords: ["fresh"], bannedPhrases: [], sampleCaption: null, notes: null }
            : null;
        },
      },
      savedAiOutput: { async create({ data }: { data: Row }) { outputs.push(data); return { id: "out-1" }; } },
      aiProviderEvent: { async create({ data }: { data: Row }) { events.push(data); return {}; } },
      async $transaction<T>(fn: (tx: unknown) => Promise<T>) { return fn(db); },
    };
    return { db: db as unknown as GenerationDb, jobs, outputs, events, countWhere: () => countWhere };
  }
  const input = { clientId: CLIENT, profileId: "p1", provider: "openai" as const, model: "gpt-test", dailyLimit: 3, request: baseRequest };

  await check("a success is saved as an AI-generated draft with a completed job", async () => {
    const fake = fakeDb();
    let sent = "";
    const outcome = await generateForWorkspace(fake.db, async (prompt) => { sent = prompt.user; return { ok: true, text: "Texte", inputTokens: 1, outputTokens: 1 }; }, { ...input, request: { ...baseRequest, brandVoiceId: VOICE } });
    assert.ok(outcome.ok);
    assert.match(sent, /Promouvoir/);
    assert.equal(fake.jobs[0].status, "completed");
    assert.equal(fake.jobs[0].provider, "openai");
    assert.equal(fake.jobs[0].brandVoiceId, VOICE);
    assert.equal(fake.outputs[0].origin, "ai_generated");
    assert.equal(fake.outputs[0].status, "draft");
    assert.equal(fake.outputs[0].clientId, CLIENT);
    assert.equal(fake.events[0].status, "succeeded");
    assert.equal(JSON.stringify(fake.events).includes("Promouvoir"), false, "prompt text never stored in provider events");
    assert.deepEqual((fake.countWhere() as Row).clientId, CLIENT);
    assert.deepEqual((fake.countWhere() as Row).metadata, { path: ["source"], equals: GENERATION_SOURCE }, "the cap counts only AI Studio generation jobs");
    assert.equal((fake.jobs[0].metadata as Row).source, GENERATION_SOURCE);
  });

  await check("Claude jobs need no enum change: stored as internal, vendor in metadata", async () => {
    const fake = fakeDb();
    const outcome = await generateForWorkspace(fake.db, async () => ({ ok: true, text: "Texte", inputTokens: 1, outputTokens: 1 }), { ...input, provider: "anthropic", model: "claude-test" });
    assert.ok(outcome.ok);
    assert.equal(fake.jobs[0].provider, "internal");
    assert.equal((fake.jobs[0].metadata as Row).provider, "anthropic");
    assert.equal(fake.events[0].provider, "internal");
    assert.equal((fake.events[0].metadata as Row).provider, "anthropic");
    assert.equal((fake.outputs[0].metadata as Row).provider, "anthropic");
    assert.equal(dbProvider("openai"), "openai");
  });

  await check("daily cap, foreign brand voices and provider failures are handled", async () => {
    const capped = fakeDb({ jobsToday: 3 });
    assert.deepEqual(await generateForWorkspace(capped.db, async () => { throw new Error("must not call"); }, input), { ok: false, reason: "daily_limit" });
    assert.equal(capped.jobs.length, 0);

    const foreign = fakeDb({ voiceClient: "22222222-2222-4222-8222-222222222222" });
    assert.deepEqual(await generateForWorkspace(foreign.db, async () => { throw new Error("must not call"); }, { ...input, request: { ...baseRequest, brandVoiceId: VOICE } }), { ok: false, reason: "voice_not_found" });

    const failing = fakeDb();
    assert.deepEqual(await generateForWorkspace(failing.db, async () => ({ ok: false, code: "auth" }), input), { ok: false, reason: "auth" });
    assert.equal(failing.jobs[0].status, "failed");
    assert.equal(failing.jobs[0].errorMessage, "auth");
    assert.equal(failing.outputs.length, 0);
    assert.equal(failing.events[0].status, "failed");

    const throwing = fakeDb();
    assert.deepEqual(await generateForWorkspace(throwing.db, async () => { throw new Error("boom"); }, input), { ok: false, reason: "network" });
    assert.equal(throwing.jobs[0].status, "failed");
  });

  await check("route and page keep generation gated and workspace-scoped; no migration", () => {
    const route = readFileSync("src/app/api/ai-studio/generate/route.ts", "utf8");
    assert.ok(route.indexOf("readAiStudioConfig()") < route.indexOf("requireWorkspaceApiPermission(\"create_content\")"));
    assert.match(route, /requireWorkspaceApiPermission\("create_content"\)/);
    assert.match(route, /readJsonBody\(request/);
    assert.match(route, /clientId: gate\.access\.activeClientId/);
    const page = readFileSync("src/app/dashboard/ai-studio/content-generator/page.tsx", "utf8");
    assert.match(page, /access\.mode === "client_scoped" && hasEffectivePermission\(access, "create_content"\)/);
    const form = readFileSync("src/components/ai-studio/content-generator-form.tsx", "utf8");
    assert.doesNotMatch(form, /API_KEY|apiKey/);
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    assert.doesNotMatch(schema.slice(schema.indexOf("enum AiProvider")).split("}")[0], /anthropic/, "no database change: no new AiProvider value");
    for (const list of ["scripts/reconcile-production-migrations.mjs", "scripts/reconcile-staging-migrations.mjs"]) {
      assert.doesNotMatch(readFileSync(list, "utf8"), /ai_provider_anthropic/, `${list} approves no AI Studio migration`);
    }
  });

  console.log(`\n${passed} AI Studio generation checks passed.`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
