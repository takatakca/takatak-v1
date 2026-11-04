// takatak.ca → dashboard, against a real database (ephemeral CI Postgres or
// local): what TAK-TAK's assistant sends from the homepage goes through the
// real public intake route and shows up in the Lead Inbox of the TAKATAK
// agency workspace, and nowhere else. Synthetic data only; refuses
// non-loopback databases. No network, no email (no alert address is set).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/public/website-requests/route";
import { getPrisma } from "@/lib/db/prisma";
import { getLeadContactsData } from "@/lib/leads/leads-data";
import type { TenantAccess } from "@/lib/security/tenant-access";
import { resetRateLimitForTests } from "@/lib/website-leads/rate-limit";
import { WEBSITE_LEAD_SOURCE_NAME } from "@/lib/website-leads/store";
import { planHandoffPayload, planSignature } from "@/lib/website/plan-handoff";
import { emptyFiche, fichePayload } from "@/lib/website/sales-fiche";

let ip = 10;
function post(body: unknown): Promise<Response> {
  ip += 1;
  return POST(
    new NextRequest("http://localhost:3000/api/public/website-requests", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": `203.0.113.${ip}` },
      body: JSON.stringify(body),
    }),
  );
}

const scoped = (clientId: string): TenantAccess => ({
  mode: "client_scoped",
  profileId: randomUUID(),
  role: "owner",
  allowedClientIds: [clientId],
  activeClientId: clientId,
  customPermissions: [],
  deniedPermissions: [],
});

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  }
  const prisma = getPrisma()!;
  const agency = await prisma.client.create({ data: { name: `TAKATAK agency ${randomUUID()}` } });
  const other = await prisma.client.create({ data: { name: `Other client ${randomUUID()}` } });
  delete process.env.WEBSITE_LEADS_NOTIFY_EMAIL;
  resetRateLimitForTests();

  // Intake off: nothing is stored and the assistant says so (it offers a person instead).
  delete process.env.WEBSITE_LEADS_ENABLED;
  const off = await post({ kind: "project_request", title: "X", email: "off@example.test" });
  assert.equal(off.status, 503);
  assert.equal(((await off.json()) as { code?: string }).code, "not_enabled");
  console.log("PASS with the intake off, a request is refused and nothing is stored");

  process.env.WEBSITE_LEADS_ENABLED = "true";
  process.env.WEBSITE_LEADS_CLIENT_ID = agency.id;

  // Exactly what the homepage assistant sends after "Prepare my request" → "Yes, send it".
  const fiche = { ...emptyFiche(), name: "Marie Tremblay", company: "Café Tremblay", address: "123 rue Saint-Denis, Montréal", email: "Marie@Example.test", phone: "514 555 0101" };
  const payload = fichePayload(fiche, { services: ["Site web", "Fiches locales"], conversation: ["> J’ai un restaurant", "> Je veux plus de clients"], lang: "fr" });
  const sent = await post(payload);
  assert.equal(sent.status, 200);
  const { reference } = (await sent.json()) as { ok: boolean; reference: string };
  assert.match(reference, /^[0-9A-F]{8}$/);

  const rows = await prisma.lead.findMany({ where: { clientId: agency.id }, include: { leadSource: true } });
  assert.equal(rows.length, 1);
  const lead = rows[0];
  assert.equal(lead.leadSource?.name, WEBSITE_LEAD_SOURCE_NAME);
  assert.equal(lead.status, "new_internal");
  assert.equal(lead.email, "marie@example.test");
  assert.equal(lead.company, "Café Tremblay");
  assert.ok(lead.message?.includes("Site web, Fiches locales"), "the services chosen with the assistant are in the lead");
  assert.ok(lead.message?.includes("123 rue Saint-Denis"), "the address from the request form is in the lead");
  assert.ok(lead.message?.includes("Je veux plus de clients"), "what the visitor wrote is in the lead");
  const meta = lead.metadata as { origin?: string; kind?: string; language?: string; sourcePage?: string };
  assert.deepEqual([meta.origin, meta.kind, meta.language, meta.sourcePage], ["takatak_website", "project_request", "fr", "/"]);
  console.log("PASS the assistant's request becomes one new lead in the agency workspace, with the services, address and conversation");

  const note = await prisma.notification.findFirstOrThrow({ where: { clientId: agency.id, relatedEntityId: lead.id } });
  for (const secret of ["marie@example.test", "514 555 0101", "Marie Tremblay"]) {
    assert.ok(!`${note.title} ${note.message}`.includes(secret), `the team notification never carries ${secret}`);
  }
  assert.equal(await prisma.auditLog.count({ where: { entityId: lead.id, action: "website_request_received" } }), 1);
  console.log("PASS the team gets an in-app notification without contact details, and the audit log records the request");

  const inbox = await getLeadContactsData(scoped(agency.id));
  assert.equal(inbox.source, "database", "the inbox reads the database, not demo data");
  const card = inbox.leads.find((l) => l.id === lead.id);
  assert.ok(card, "the lead is in the agency's Lead Inbox");
  assert.equal(card.sourceName, WEBSITE_LEAD_SOURCE_NAME);
  assert.equal(card.status, "new_internal");
  const elsewhere = await getLeadContactsData(scoped(other.id));
  assert.ok(!elsewhere.leads.some((l) => l.id === lead.id), "another client's inbox never shows it");
  console.log("PASS the Lead Inbox of the agency shows it (source: takatak.ca website); another client's inbox does not");

  // A double click or a resend within 15 minutes is the same request, not a second lead.
  const again = await post(payload);
  assert.equal(((await again.json()) as { reference: string }).reference, reference);
  assert.equal(await prisma.lead.count({ where: { clientId: agency.id } }), 1);
  console.log("PASS sending the same request again returns the same reference, never a second lead");

  // Bots filling the hidden field get a normal answer and nothing is stored; no contact means no lead.
  const bot = await post({ ...payload, email: "bot@example.test", website: "http://spam.example" });
  assert.equal(bot.status, 200);
  const noContact = await post({ ...payload, email: undefined, phone: undefined });
  assert.equal(noContact.status, 400);
  assert.equal(await prisma.lead.count({ where: { clientId: agency.id } }), 1);
  console.log("PASS a bot (hidden field) or a request without any contact stores nothing");

  // The domain search request from the site lands in the same inbox.
  const domain = await post({ kind: "domain_request", domain: "cafetremblay.ca", tld: "ca", email: "marie@example.test", language: "fr", sourcePage: "/domains" });
  assert.equal(domain.status, 200);
  const after = await getLeadContactsData(scoped(agency.id));
  assert.equal(after.leads.length, 2);
  assert.ok(after.leads.some((l) => l.messagePreview?.includes("cafetremblay.ca")), "the domain request shows the domain in the inbox");
  console.log("PASS a domain request from the site also lands in the agency's inbox");

  // The plan built on the homepage reaches the team after sign-up (dashboard PlanHandoff).
  // In production the email comes from the signed-in session; here it is given.
  assert.equal(planSignature(["local", "website"], null), planSignature(["website", "local", "website"], null), "same plan, same signature");
  assert.notEqual(planSignature(["website"], null), planSignature(["website"], "FETES2026"));
  const plan = planHandoffPayload(["website", "local"], "<script>", "fr");
  assert.ok(!plan.message.includes("<script>"), "an odd promo value is never copied into the lead");
  assert.equal(plan.title, "Forfait choisi sur takatak.ca · Site web, Fiches locales");
  const handoff = await post({ ...planHandoffPayload(["website", "local"], "FETES2026", "fr"), email: "nouveau@example.test" });
  assert.equal(handoff.status, 200);
  const planLead = await prisma.lead.findFirstOrThrow({ where: { clientId: agency.id, email: "nouveau@example.test" } });
  assert.ok(planLead.message?.includes("Site web, Fiches locales") && planLead.message.includes("FETES2026"));
  assert.equal((planLead.metadata as { project?: { category?: string } }).project?.category, "homepage-plan");
  const withPlan = await getLeadContactsData(scoped(agency.id));
  assert.ok(withPlan.leads.some((l) => l.id === planLead.id), "the plan lead is in the agency's inbox");
  console.log("PASS the plan built on the homepage lands in the agency's inbox once the client has an account");

  await prisma.notification.deleteMany({ where: { clientId: { in: [agency.id, other.id] } } });
  await prisma.auditLog.deleteMany({ where: { clientId: { in: [agency.id, other.id] } } });
  await prisma.lead.deleteMany({ where: { clientId: { in: [agency.id, other.id] } } });
  await prisma.leadSource.deleteMany({ where: { clientId: { in: [agency.id, other.id] } } });
  await prisma.client.deleteMany({ where: { id: { in: [agency.id, other.id] } } });
  await prisma.$disconnect();
  console.log("website lead → inbox DB tests: OK");
}

main().catch(async (error) => {
  console.error("FAIL", error);
  await getPrisma()?.$disconnect();
  process.exit(1);
});
