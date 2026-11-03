// TAK-TAK trial on the homepage, against a real database (ephemeral CI
// Postgres or local): a signed-in visitor's workspace gets its trial credits
// once ever, and the sign-up shows in the TAKATAK agency's Lead Inbox.
// Synthetic data only; refuses non-loopback databases. No AI call is made
// (a placeholder key only marks the economy engine as connected).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { providerEntry } from "@/lib/ai-providers/catalog";
import { getPrisma } from "@/lib/db/prisma";
import { getLeadContactsData } from "@/lib/leads/leads-data";
import { claimTrial, creditBalance, trialStatus } from "@/lib/takbot/server";
import { TRIAL_DEFAULT_CREDITS, TRIAL_ECONOMY_ORDER } from "@/lib/takbot/trial";
import { TRIAL_LEAD_SOURCE, recordTrialLead } from "@/lib/takbot/trial-lead";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  }
  const prisma = getPrisma()!;
  const engine = providerEntry(TRIAL_ECONOMY_ORDER[0]);
  assert.ok(engine, "the first economy engine is in the provider catalog");
  process.env[engine.env] = "placeholder-not-a-real-key";
  delete process.env.TAKBOT_TRIAL_CREDITS;
  delete process.env.TAKBOT_TRIAL_ENGINE;
  delete process.env.TAKBOT_TRIAL_ENABLED;

  const agency = await prisma.client.create({ data: { name: `TAKATAK agency ${randomUUID()}` } });
  const visitor = await prisma.client.create({ data: { name: `Visitor workspace ${randomUUID()}` } });

  const before = await trialStatus(visitor.id);
  assert.deepEqual([before.enabled, before.credits, before.claimed, before.premium], [true, TRIAL_DEFAULT_CREDITS, false, false]);
  console.log(`PASS a new workspace sees an open trial of ${TRIAL_DEFAULT_CREDITS} credits on ${before.engineName}`);

  const first = await claimTrial(visitor.id);
  assert.ok(first.ok && first.granted && first.balance === TRIAL_DEFAULT_CREDITS, JSON.stringify(first));
  const again = await claimTrial(visitor.id);
  assert.ok(again.ok && !again.granted && again.balance === TRIAL_DEFAULT_CREDITS, "a second claim grants nothing");
  assert.equal(await creditBalance(visitor.id), TRIAL_DEFAULT_CREDITS);
  const after = await trialStatus(visitor.id);
  assert.ok(after.claimed && !after.premium, "claimed, and the trial never unlocks premium engines");
  console.log("PASS the trial credits land in the visitor's own ledger once ever; a retry or second click is a no-op");

  const lead = await recordTrialLead(prisma, {
    agencyClientId: agency.id,
    workspaceClientId: visitor.id,
    email: "Essai@Example.test",
    name: "Jean Essai",
    language: "fr",
    sourcePage: "/",
    credits: before.credits,
  });
  assert.ok(lead?.created);
  const repeat = await recordTrialLead(prisma, { agencyClientId: agency.id, workspaceClientId: visitor.id, email: "essai@example.test", name: null, language: "fr", sourcePage: "/", credits: before.credits });
  assert.equal(repeat?.id, lead.id, "the same person is one lead, not two");
  const inbox = await getLeadContactsData({
    mode: "client_scoped", profileId: randomUUID(), role: "owner",
    allowedClientIds: [agency.id], activeClientId: agency.id, customPermissions: [], deniedPermissions: [],
  });
  const card = inbox.leads.find((l) => l.id === lead.id);
  assert.ok(card && card.sourceName === TRIAL_LEAD_SOURCE && card.email === "essai@example.test");
  assert.equal(await prisma.lead.count({ where: { clientId: visitor.id } }), 0, "nothing is written in the visitor's workspace");
  console.log("PASS the trial sign-up is one lead in the agency's inbox (source: TAK bot trial), never in the visitor's workspace");

  process.env.TAKBOT_TRIAL_ENABLED = "false";
  const off = await claimTrial(randomUUID());
  assert.deepEqual(off, { ok: false, code: "trial_unavailable" });
  console.log("PASS the owner can switch the trial off; then nothing is granted");

  await prisma.aiCreditEntry.deleteMany({ where: { clientId: visitor.id } });
  await prisma.auditLog.deleteMany({ where: { clientId: { in: [agency.id, visitor.id] } } });
  await prisma.lead.deleteMany({ where: { clientId: agency.id } });
  await prisma.leadSource.deleteMany({ where: { clientId: agency.id } });
  await prisma.client.deleteMany({ where: { id: { in: [agency.id, visitor.id] } } }).catch(() => undefined);
  await prisma.$disconnect();
  console.log("TAK-TAK trial DB tests: OK");
}

main().catch(async (error) => {
  console.error("FAIL", error);
  await getPrisma()?.$disconnect();
  process.exit(1);
});
