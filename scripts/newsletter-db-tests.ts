// Homepage newsletter (CASL double opt-in), against a real database
// (ephemeral CI Postgres or local): a sign-up is one lead in the TAKATAK
// agency inbox with its consent proof; the confirm link confirms it, the
// unsubscribe link archives it, and only a confirmed address may be emailed.
// Synthetic data only; refuses non-loopback databases. No email is sent.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";
import { getLeadContactsData } from "@/lib/leads/leads-data";
import { CONSENT_VERSION, maySend, readState, type ConsentProof } from "@/lib/newsletter/consent";
import { NEWSLETTER_SOURCE_NAME, RESEND_WINDOW_MS, applyLink, recordSignup } from "@/lib/newsletter/store";

const signup = { email: "abonne@example.test", language: "fr" as const, topics: ["offers", "tips"] as ("offers" | "tips")[], sourcePage: "/", consentVersion: CONSENT_VERSION };
const proof = (givenAt: Date): ConsentProof => ({
  version: CONSENT_VERSION,
  text: "Oui, je veux recevoir les infolettres de Groupe TAKATAK.",
  language: "fr",
  givenAt: givenAt.toISOString(),
  sourcePage: "/",
  sourceHash: "hash-of-the-caller",
  method: "web_form_checkbox",
});

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  }
  const prisma = getPrisma()!;
  const agency = await prisma.client.create({ data: { name: `TAKATAK agency ${randomUUID()}` } });
  const other = await prisma.client.create({ data: { name: `Other client ${randomUUID()}` } });
  const t0 = new Date("2026-11-03T15:00:00Z");

  const first = await recordSignup(prisma, { clientId: agency.id, signup, proof: proof(t0), now: t0 });
  assert.equal(first.status, "pending");
  assert.equal(first.sendConfirmation, true, "a new sign-up gets one confirmation email");
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: first.id }, include: { leadSource: true } });
  assert.equal(lead.leadSource?.name, NEWSLETTER_SOURCE_NAME);
  const state = readState(lead.metadata);
  assert.ok(state && state.consents.length === 1 && state.consents[0].text.startsWith("Oui"), "the exact consent text is kept as proof");
  assert.equal(maySend(state), false, "nothing may be sent before the address is confirmed");
  console.log("PASS a sign-up is one pending lead with its consent proof; no newsletter may be sent yet");

  const repeat = await recordSignup(prisma, { clientId: agency.id, signup, proof: proof(new Date(t0.getTime() + 60_000)), now: new Date(t0.getTime() + 60_000) });
  assert.equal(repeat.id, first.id);
  assert.equal(repeat.sendConfirmation, false, "a double click does not send a second email");
  assert.equal(await prisma.lead.count({ where: { clientId: agency.id } }), 1);
  console.log("PASS a repeat within the resend window changes nothing and sends nothing");

  const wrong = await applyLink(prisma, { clientId: agency.id, id: first.id, action: "confirm", stamp: "2020-01-01T00:00:00.000Z", now: t0 });
  assert.equal(wrong, "expired_link", "a confirm link only confirms the sign-up it was sent for");
  assert.equal(await applyLink(prisma, { clientId: other.id, id: first.id, action: "confirm", stamp: first.stamp, now: t0 }), null, "another workspace cannot touch it");
  const ok = await applyLink(prisma, { clientId: agency.id, id: first.id, action: "confirm", stamp: first.stamp, now: new Date(t0.getTime() + 120_000) });
  assert.equal(ok, "confirmed");
  assert.equal(maySend(readState((await prisma.lead.findUniqueOrThrow({ where: { id: first.id } })).metadata)), true);
  console.log("PASS the confirm link confirms it (only that link, only this workspace); then it may be emailed");

  const inbox = await getLeadContactsData({
    mode: "client_scoped", profileId: randomUUID(), role: "owner",
    allowedClientIds: [agency.id], activeClientId: agency.id, customPermissions: [], deniedPermissions: [],
  });
  const card = inbox.leads.find((l) => l.id === first.id);
  assert.ok(card && card.sourceName === NEWSLETTER_SOURCE_NAME && card.messagePreview?.includes("confirmed"));
  console.log("PASS the subscriber shows in the agency's Lead Inbox (source: takatak.ca newsletter, confirmed)");

  const out = await applyLink(prisma, { clientId: agency.id, id: first.id, action: "unsubscribe", now: new Date(t0.getTime() + 180_000) });
  assert.equal(out, "unsubscribed");
  const after = await prisma.lead.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(after.status, "archived");
  assert.equal(maySend(readState(after.metadata)), false);
  console.log("PASS the unsubscribe link archives the lead at once; nothing may be sent after that");

  const later = new Date(t0.getTime() + RESEND_WINDOW_MS + 86_400_000);
  const back = await recordSignup(prisma, { clientId: agency.id, signup, proof: proof(later), now: later });
  assert.equal(back.id, first.id);
  assert.equal(back.status, "pending", "coming back needs a new confirmation");
  assert.equal(readState((await prisma.lead.findUniqueOrThrow({ where: { id: first.id } })).metadata)?.consents.length, 2, "both consents are kept");
  const audits = await prisma.auditLog.findMany({ where: { entityId: first.id }, select: { action: true } });
  assert.deepEqual(
    audits.map((a) => a.action).sort(),
    ["newsletter_confirmed", "newsletter_consent_recorded", "newsletter_consent_recorded", "newsletter_unsubscribed"].sort(),
  );
  console.log("PASS signing up again needs a new confirmation; every consent, confirmation and unsubscribe is in the audit log");

  await prisma.auditLog.deleteMany({ where: { clientId: { in: [agency.id, other.id] } } });
  await prisma.lead.deleteMany({ where: { clientId: { in: [agency.id, other.id] } } });
  await prisma.leadSource.deleteMany({ where: { clientId: { in: [agency.id, other.id] } } });
  await prisma.client.deleteMany({ where: { id: { in: [agency.id, other.id] } } });
  await prisma.$disconnect();
  console.log("newsletter DB tests: OK");
}

main().catch(async (error) => {
  console.error("FAIL", error);
  await getPrisma()?.$disconnect();
  process.exit(1);
});
