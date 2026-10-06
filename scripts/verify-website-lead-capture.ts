// Website lead capture — pure + in-memory store checks (no network, no DB).
// Run: npm run qa:website-leads
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { readWebsiteLeadsConfig } from "../src/lib/website-leads/config";
import {
  allowRequest,
  hashRequestSource,
  PER_SOURCE_LIMIT,
  PER_SOURCE_WINDOW_MS,
  resetRateLimitForTests,
} from "../src/lib/website-leads/rate-limit";
import {
  DUPLICATE_WINDOW_MS,
  FLOOD_LIMIT,
  recordWebsiteRequest,
  referenceFor,
  WEBSITE_LEAD_SOURCE_NAME,
  WebsiteLeadRateLimitedError,
  type LeadStoreDb,
} from "../src/lib/website-leads/store";
import {
  hasContact,
  validateWebsiteRequest,
  type WebsiteRequestInput,
} from "../src/lib/website-leads/validation";

const CLIENT = "11111111-1111-4111-8111-111111111111";
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

type Row = Record<string, unknown> & { id: string; createdAt: Date };

/** Minimal in-memory stand-in for the Prisma calls used by store.ts. */
function fakeDb(now: Date) {
  const sources: Row[] = [];
  const leads: Row[] = [];
  const audits: Row[] = [];
  let seq = 0;
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const within = (row: Row, gte?: Date) => !gte || row.createdAt >= gte;

  const tx = {
    leadSource: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        const found = sources.find((s) =>
          s.clientId === where.clientId && s.type === where.type && s.name === where.name);
        return found ? { id: found.id } : null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row = { ...data, id: id(), createdAt: now };
        sources.push(row);
        return { id: row.id };
      },
    },
    lead: {
      async count({ where }: { where: { clientId: string; leadSourceId: string; createdAt: { gte: Date } } }) {
        return leads.filter((l) =>
          l.clientId === where.clientId && l.leadSourceId === where.leadSourceId &&
          within(l, where.createdAt.gte)).length;
      },
      async findFirst({ where }: { where: { clientId: string; leadSourceId: string; createdAt: { gte: Date }; OR: Array<Record<string, string>>; message: { startsWith: string } } }) {
        const found = leads.find((l) =>
          l.clientId === where.clientId && l.leadSourceId === where.leadSourceId &&
          within(l, where.createdAt.gte) &&
          where.OR.some((c) => Object.entries(c).every(([k, v]) => l[k] === v)) &&
          String(l.message).startsWith(where.message.startsWith));
        return found ? { id: found.id } : null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row = { ...data, id: id(), createdAt: now };
        leads.push(row);
        return { id: row.id };
      },
    },
    auditLog: {
      async create({ data }: { data: Record<string, unknown> }) {
        audits.push({ ...data, id: id(), createdAt: now });
        return {};
      },
    },
  };

  const db = {
    async $transaction<T>(fn: (t: typeof tx) => Promise<T>) {
      return fn(tx);
    },
  } as unknown as LeadStoreDb;

  return { db, sources, leads, audits };
}

function domainInput(overrides: Partial<WebsiteRequestInput> = {}): WebsiteRequestInput {
  return {
    kind: "domain_request",
    name: "Client Exemple",
    email: "client@example.test",
    phone: null,
    company: null,
    message: null,
    language: "fr",
    sourcePage: "/domain",
    domain: { fqdn: "monentreprise.ca", tld: "ca" },
    project: null,
    ...overrides,
  };
}

async function main() {
  console.log("Website lead capture checks");

  await check("config is off unless enabled with a workspace uuid", () => {
    assert.deepEqual(readWebsiteLeadsConfig({}), { enabled: false });
    assert.deepEqual(readWebsiteLeadsConfig({ WEBSITE_LEADS_ENABLED: "true" }), { enabled: false });
    assert.deepEqual(
      readWebsiteLeadsConfig({ WEBSITE_LEADS_ENABLED: "true", WEBSITE_LEADS_CLIENT_ID: "nope" }),
      { enabled: false },
    );
    assert.deepEqual(
      readWebsiteLeadsConfig({ WEBSITE_LEADS_ENABLED: "1", WEBSITE_LEADS_CLIENT_ID: CLIENT }),
      { enabled: false },
    );
    assert.deepEqual(
      readWebsiteLeadsConfig({ WEBSITE_LEADS_ENABLED: "true", WEBSITE_LEADS_CLIENT_ID: CLIENT }),
      { enabled: true, clientId: CLIENT },
    );
  });

  await check("valid domain and project requests are normalized", () => {
    const domain = validateWebsiteRequest({
      kind: "domain_request", domain: "MonEntreprise.CA", tld: ".ca",
      name: "  Client  ", email: "Client@Example.TEST", language: "fr", sourcePage: "/domain",
      unknownField: "ignored",
    });
    assert.ok(domain.ok);
    if (domain.ok) {
      assert.equal(domain.value.domain?.fqdn, "monentreprise.ca");
      assert.equal(domain.value.email, "client@example.test");
      assert.equal(domain.value.name, "Client");
      assert.equal(domain.value.language, "fr");
      assert.equal(domain.honeypot, false);
      assert.equal("unknownField" in domain.value, false);
    }
    const project = validateWebsiteRequest({
      kind: "project_request", title: "Site web 5 pages", category: "website_design",
      budget: "1,500", timeline: "2_4_weeks", phone: "+1 514 555 0100",
    });
    assert.ok(project.ok);
    if (project.ok) {
      assert.equal(project.value.project?.budgetCents, 150000);
      assert.equal(project.value.phone, "+1 514 555 0100");
    }
  });

  await check("invalid or oversized fields are rejected", () => {
    const bad: unknown[] = [
      null, [], "text", {},
      { kind: "spam" },
      { kind: "domain_request", domain: "bad domain", tld: "ca", email: "a@b.ca" },
      { kind: "domain_request", domain: "a..ca", tld: "ca", email: "a@b.ca" },
      { kind: "domain_request", domain: "brand.com", tld: "ca", email: "a@b.ca" },
      { kind: "domain_request", domain: "brand.ca", tld: "ca", email: "not-an-email" },
      { kind: "domain_request", domain: "brand.ca", tld: "ca", phone: "call me maybe" },
      { kind: "domain_request", domain: "brand.ca", tld: "ca", email: "a@b.ca", name: "x".repeat(121) },
      { kind: "project_request", email: "a@b.ca" },
      { kind: "project_request", title: "T", email: "a@b.ca", message: "x".repeat(4001) },
      { kind: "project_request", title: "T", email: "a@b.ca", budget: "-5" },
      { kind: "project_request", title: "T", email: "a@b.ca", budget: "abc" },
      { kind: "project_request", title: 42, email: "a@b.ca" },
    ];
    for (const value of bad) {
      assert.equal(validateWebsiteRequest(value).ok, false, JSON.stringify(value)?.slice(0, 80));
    }
  });

  await check("unsafe values are neutralized, honeypot is detected", () => {
    const result = validateWebsiteRequest({
      kind: "project_request", title: "T\u0000itle", email: "a@b.ca",
      sourcePage: "//evil.example/x", category: "../../etc", website: "http://spam",
    });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.value.project?.title, "Title");
      assert.equal(result.value.sourcePage, null);
      assert.equal(result.value.project?.category, null);
      assert.equal(result.honeypot, true);
    }
  });

  await check("a contact method is required", () => {
    assert.equal(hasContact({ email: null, phone: null }), false);
    assert.equal(hasContact({ email: "a@b.ca", phone: null }), true);
    assert.equal(hasContact({ email: null, phone: "5145550100" }), true);
  });

  await check("per-source limiter blocks bursts and hashes addresses", () => {
    resetRateLimitForTests();
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    const hash = hashRequestSource(headers);
    assert.match(hash, /^[a-f0-9]{32}$/);
    assert.equal(hash.includes("203"), false);
    const t0 = 1_000_000;
    for (let i = 0; i < PER_SOURCE_LIMIT; i += 1) assert.equal(allowRequest(hash, t0 + i), true);
    assert.equal(allowRequest(hash, t0 + 10), false);
    assert.equal(allowRequest(hashRequestSource(new Headers({ "x-forwarded-for": "198.51.100.2" })), t0), true);
    assert.equal(allowRequest(hash, t0 + PER_SOURCE_WINDOW_MS + 100), true);
  });

  await check("first request creates the website source, lead and audit entry", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    const fake = fakeDb(now);
    const recorded = await recordWebsiteRequest(fake.db, {
      clientId: CLIENT, request: domainInput(), authUserId: null, sourceHash: "h", now,
    });
    assert.equal(recorded.duplicate, false);
    assert.equal(recorded.reference, referenceFor(recorded.leadId));
    assert.equal(fake.sources.length, 1);
    assert.equal(fake.sources[0].name, WEBSITE_LEAD_SOURCE_NAME);
    assert.equal(fake.sources[0].type, "website_form");
    assert.equal(fake.leads.length, 1);
    const lead = fake.leads[0];
    assert.equal(lead.clientId, CLIENT);
    assert.equal(lead.status, "new_internal");
    assert.equal(lead.email, "client@example.test");
    assert.match(String(lead.message), /^Domain request: monentreprise\.ca/);
    assert.equal((lead.metadata as Record<string, unknown>).origin, "takatak_website");
    assert.equal(fake.audits.length, 1);
    assert.equal(fake.audits[0].action, "website_request_received");
  });

  await check("a quick resubmission is collapsed, a different request is not", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    const fake = fakeDb(now);
    const base = { clientId: CLIENT, authUserId: null, sourceHash: "h", now };
    const first = await recordWebsiteRequest(fake.db, { ...base, request: domainInput() });
    const again = await recordWebsiteRequest(fake.db, { ...base, request: domainInput() });
    assert.equal(again.duplicate, true);
    assert.equal(again.leadId, first.leadId);
    const other = await recordWebsiteRequest(fake.db, {
      ...base, request: domainInput({ domain: { fqdn: "autre.ca", tld: "ca" } }),
    });
    assert.equal(other.duplicate, false);
    assert.equal(fake.leads.length, 2);
    const later = new Date(now.getTime() + DUPLICATE_WINDOW_MS + 1);
    const fresh = await recordWebsiteRequest(fake.db, { ...base, now: later, request: domainInput() });
    assert.equal(fresh.duplicate, false);
  });

  await check("workspace-wide flood cap stops intake", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    const fake = fakeDb(now);
    for (let i = 0; i < FLOOD_LIMIT; i += 1) {
      await recordWebsiteRequest(fake.db, {
        clientId: CLIENT, authUserId: null, sourceHash: "h", now,
        request: domainInput({ email: `c${i}@example.test` }),
      });
    }
    await assert.rejects(
      recordWebsiteRequest(fake.db, {
        clientId: CLIENT, authUserId: null, sourceHash: "h", now,
        request: domainInput({ email: "late@example.test" }),
      }),
      WebsiteLeadRateLimitedError,
    );
  });

  await check("project budget becomes the lead value", async () => {
    const now = new Date();
    const fake = fakeDb(now);
    await recordWebsiteRequest(fake.db, {
      clientId: CLIENT, authUserId: "22222222-2222-4222-8222-222222222222", sourceHash: "h", now,
      request: {
        ...domainInput(), kind: "project_request", domain: null,
        project: { title: "Menu design", category: "menu_flyer", budgetCents: 25000, timeline: "flexible" },
      },
    });
    assert.equal(fake.leads[0].valueCents, 25000);
    assert.match(String(fake.leads[0].message), /^Project request: Menu design/);
    assert.equal((fake.leads[0].metadata as Record<string, unknown>).authenticated, true);
  });

  await check("public route is gated, origin-checked and bounded", () => {
    const route = readFileSync("src/app/api/public/website-requests/route.ts", "utf8");
    assert.match(route, /readWebsiteLeadsConfig\(\)/);
    assert.match(route, /readJsonBody\(request, MAX_BODY_BYTES\)/);
    assert.match(route, /allowRequest\(sourceHash\)/);
    assert.match(route, /validation\.honeypot/);
    assert.doesNotMatch(route, /export async function (GET|PUT|PATCH|DELETE)/);
  });

  await check("website forms no longer dead-end on a missing dashboard page", () => {
    const form = readFileSync("src/components/website/marketplace/post-project-form.tsx", "utf8");
    assert.doesNotMatch(form, /\/dashboard\/marketplace/);
    assert.match(form, /submitWebsiteRequest/);
    const domain = readFileSync("src/lib/website/domain-requests.ts", "utf8");
    assert.match(domain, /submitWebsiteRequest/);
    assert.match(domain, /saveLocalRequest\(input\)/);
  });

  console.log(`\n${passed} website lead capture checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
