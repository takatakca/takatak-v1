// TAK-TAK answering on the homepage, against a real database (ephemeral CI
// Postgres or local): a run debits the workspace's credits once, the answer
// is saved in the client's file (AI Studio → saved outputs), a failed
// provider call is refunded, a resend is never charged twice, and an empty
// balance is refused. The AI provider is a local stand-in (no network, no
// real key); everything else is the real code path. Synthetic data only;
// refuses non-loopback databases.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { providerEntry } from "@/lib/ai-providers/catalog";
import { getPrisma } from "@/lib/db/prisma";
import { creditsFor, takbotMode } from "@/lib/takbot/catalog";
import { claimTrial, creditBalance, runTakbot } from "@/lib/takbot/server";
import { TRIAL_DEFAULT_CREDITS, TRIAL_ECONOMY_ORDER } from "@/lib/takbot/trial";

const ANSWER = "Voici trois idées de publications pour votre café de quartier.";
let providerCalls = 0;
let providerFails = false;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request) => {
  providerCalls += 1;
  const target = String(url instanceof Request ? url.url : url);
  assert.ok(target.startsWith("https://"), "the relay only calls https providers");
  if (providerFails) return new Response(JSON.stringify({ error: "down" }), { status: 500 });
  return new Response(JSON.stringify({ choices: [{ message: { content: ANSWER } }] }), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  }
  const prisma = getPrisma()!;
  const engine = providerEntry(TRIAL_ECONOMY_ORDER[0]);
  assert.ok(engine);
  process.env[engine.env] = "placeholder-not-a-real-key";
  delete process.env.TAKBOT_TRIAL_CREDITS;
  delete process.env.TAKBOT_TRIAL_ENGINE;
  delete process.env.TAKBOT_TRIAL_ENABLED;

  const visitor = await prisma.client.create({ data: { name: `Visitor workspace ${randomUUID()}` } });
  const other = await prisma.client.create({ data: { name: `Other workspace ${randomUUID()}` } });
  const chatCost = creditsFor(takbotMode("chat")!);
  assert.ok(chatCost > 0);

  const broke = await runTakbot({ clientId: other.id, mode: "chat", engine: "auto", prompt: "Bonjour", requestId: randomUUID() });
  assert.ok(!broke.ok && broke.status === 402, "no credits, no answer");
  assert.equal(providerCalls, 0, "the provider is never called without credits");
  console.log("PASS a workspace without credits is refused before any AI call");

  assert.ok((await claimTrial(visitor.id)).ok);
  const requestId = randomUUID();
  const run = await runTakbot({ clientId: visitor.id, mode: "chat", engine: "auto", prompt: "Écris 3 publications pour mon café", requestId });
  assert.ok(run.ok, JSON.stringify(run));
  assert.equal(run.text, ANSWER);
  assert.equal(run.trial, true);
  assert.equal(run.balance, TRIAL_DEFAULT_CREDITS - chatCost);
  assert.equal(await creditBalance(visitor.id), TRIAL_DEFAULT_CREDITS - chatCost);
  console.log(`PASS a run answers and debits ${chatCost} credit(s) from the visitor's own ledger`);

  assert.ok(run.savedId);
  const saved = await prisma.savedAiOutput.findUniqueOrThrow({ where: { id: run.savedId } });
  assert.equal(saved.clientId, visitor.id);
  assert.equal(saved.content, ANSWER);
  assert.equal(saved.origin, "ai_generated");
  assert.equal((saved.metadata as { source?: string; trial?: boolean }).source, "takbot");
  assert.equal(await prisma.savedAiOutput.count({ where: { clientId: other.id } }), 0);
  console.log("PASS the answer is saved in the client's own file (AI Studio saved outputs), nowhere else");

  const again = await runTakbot({ clientId: visitor.id, mode: "chat", engine: "auto", prompt: "Écris 3 publications pour mon café", requestId });
  assert.ok(!again.ok && again.status === 409);
  assert.equal(await creditBalance(visitor.id), TRIAL_DEFAULT_CREDITS - chatCost, "a resend is never charged twice");
  console.log("PASS the same request sent again is refused and never charged twice");

  providerFails = true;
  const callsBefore = providerCalls;
  const failed = await runTakbot({ clientId: visitor.id, mode: "chat", engine: "auto", prompt: "Encore une idée", requestId: randomUUID() });
  assert.ok(!failed.ok);
  assert.equal(providerCalls, callsBefore + 1);
  assert.equal(await creditBalance(visitor.id), TRIAL_DEFAULT_CREDITS - chatCost, "a failed answer is refunded");
  assert.equal(await prisma.savedAiOutput.count({ where: { clientId: visitor.id } }), 1, "nothing is saved for a failed answer");
  console.log("PASS when the AI provider fails, the credits are refunded and nothing is saved");

  await prisma.savedAiOutput.deleteMany({ where: { clientId: { in: [visitor.id, other.id] } } });
  await prisma.aiCreditEntry.deleteMany({ where: { clientId: { in: [visitor.id, other.id] } } });
  await prisma.auditLog.deleteMany({ where: { clientId: { in: [visitor.id, other.id] } } });
  await prisma.client.deleteMany({ where: { id: { in: [visitor.id, other.id] } } }).catch(() => undefined);
  await prisma.$disconnect();
  globalThis.fetch = realFetch;
  console.log("TAK-TAK run DB tests: OK");
}

main().catch(async (error) => {
  console.error("FAIL", error);
  await getPrisma()?.$disconnect();
  process.exit(1);
});
