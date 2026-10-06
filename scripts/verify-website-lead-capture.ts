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
import { priceMarketplaceOrder } from "../src/lib/website-leads/package-pricing";
import { leadAlertEmail } from "../src/lib/website-leads/notify";
import {
  linkFor,
  markNotificationsRead,
  parseMarkReadBody,
  visibleTo,
  type NotificationsDb,
} from "../src/lib/notifications/workspace-notifications";
import { MARKETPLACE_PACKAGES } from "../src/lib/website/marketplace-catalog";
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
  const notifications: Row[] = [];
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
    notification: {
      async create({ data }: { data: Record<string, unknown> }) {
        notifications.push({ ...data, id: id(), createdAt: now });
        return {};
      },
    },
  };

  const db = {
    async $transaction<T>(fn: (t: typeof tx) => Promise<T>) {
      return fn(tx);
    },
  } as unknown as LeadStoreDb;

  return { db, sources, leads, audits, notifications };
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
    order: null,
    hosting: null,
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
      { enabled: true, clientId: CLIENT, notifyEmail: null },
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


  await check("package orders accept identifiers only and are priced from the catalog", () => {
    const pkg = MARKETPLACE_PACKAGES.find((p) => p.addons.length > 0)!;
    const tier = pkg.tiers[pkg.tiers.length - 1];
    const addon = pkg.addons[0];
    const parsed = validateWebsiteRequest({
      kind: "package_order", packageId: pkg.id, tierName: tier.name,
      addons: [addon.label], promoCode: "first10",
      totalCents: 1, finalTotalCents: 1, tierPriceCents: 1,
    });
    assert.ok(parsed.ok);
    if (!parsed.ok || !parsed.value.order) return;
    assert.equal("totalCents" in parsed.value.order, false);
    const priced = priceMarketplaceOrder(parsed.value.order)!;
    const subtotal = tier.priceCents + addon.priceCents;
    assert.equal(priced.subtotalCents, subtotal);
    assert.equal(priced.discountCents, Math.round(subtotal * 0.1));
    assert.equal(priced.totalCents, subtotal - Math.round(subtotal * 0.1));
    assert.equal(priceMarketplaceOrder({ ...parsed.value.order, promoCode: "FREE100" })!.discountCents, 0);
    assert.equal(priceMarketplaceOrder({ ...parsed.value.order, packageId: "does-not-exist" }), null);
    assert.equal(priceMarketplaceOrder({ ...parsed.value.order, tierName: "Platinum" }), null);
    assert.equal(priceMarketplaceOrder({ ...parsed.value.order, addonLabels: ["Free extra"] }), null);
    for (const bad of [
      { kind: "package_order", packageId: "../etc", tierName: "Basic" },
      { kind: "package_order", packageId: pkg.id, tierName: "Gold" },
      { kind: "package_order", packageId: pkg.id, tierName: "Basic", addons: "x" },
      { kind: "package_order", packageId: pkg.id, tierName: "Basic", addons: Array(11).fill("a") },
    ]) {
      assert.equal(validateWebsiteRequest(bad).ok, false, JSON.stringify(bad));
    }
  });

  await check("package orders are stored as high-priority leads with catalog value", async () => {
    const now = new Date();
    const fake = fakeDb(now);
    const pkg = MARKETPLACE_PACKAGES[0];
    const order = { packageId: pkg.id, tierName: pkg.tiers[0].name, addonLabels: [], promoCode: null };
    const pricedOrder = priceMarketplaceOrder(order)!;
    await recordWebsiteRequest(fake.db, {
      clientId: CLIENT, authUserId: "22222222-2222-4222-8222-222222222222", sourceHash: "h", now, pricedOrder,
      request: { ...domainInput(), kind: "package_order", domain: null, order },
    });
    const lead = fake.leads[0];
    assert.equal(lead.priority, "high");
    assert.equal(lead.valueCents, pricedOrder.totalCents);
    assert.match(String(lead.message), new RegExp(`^Package order: .*\\(${pkg.tiers[0].name}\\)`));
    assert.match(String(lead.message), /not charged/);
    await assert.rejects(recordWebsiteRequest(fake.db, {
      clientId: CLIENT, authUserId: null, sourceHash: "h", now,
      request: { ...domainInput(), kind: "package_order", domain: null, order },
    }));
  });

  await check("no website link points to the missing /dashboard/marketplace page", () => {
    for (const file of [
      "src/components/website/checkout/checkout-client.tsx",
      "src/components/website/layout/SiteFooter.tsx",
      "src/lib/website/public-services.ts",
      "src/components/website/marketplace/post-project-form.tsx",
    ]) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /\/dashboard\/marketplace/, file);
    }
    const route = readFileSync("src/app/api/public/website-requests/route.ts", "utf8");
    assert.match(route, /priceMarketplaceOrder\(value\.order\)/);
  });


  await check("each new lead notifies the workspace once, without contact details", async () => {
    const now = new Date();
    const fake = fakeDb(now);
    const input = domainInput({ email: "secret.buyer@example.com", phone: "+1 514 555 0199", name: "Secret Buyer" });
    const first = await recordWebsiteRequest(fake.db, {
      clientId: CLIENT, authUserId: null, sourceHash: "h", now, request: input,
    });
    const again = await recordWebsiteRequest(fake.db, {
      clientId: CLIENT, authUserId: null, sourceHash: "h", now, request: input,
    });
    assert.equal(again.duplicate, true);
    assert.equal(fake.notifications.length, 1);
    const n = fake.notifications[0];
    assert.equal(n.clientId, CLIENT);
    assert.equal(n.title, "New domain request");
    assert.equal(n.relatedEntityType, "lead");
    assert.equal(n.relatedEntityId, first.leadId);
    assert.match(String(n.message), new RegExp(`Ref ${first.reference}`));
    for (const secret of ["secret.buyer", "555", "Secret Buyer"]) {
      assert.equal(String(n.message).includes(secret), false, secret);
      assert.equal(first.summary.includes(secret), false, secret);
    }
  });

  await check("team alert email is opt-in, internal and free of contact details", () => {
    const base = { WEBSITE_LEADS_ENABLED: "true", WEBSITE_LEADS_CLIENT_ID: CLIENT };
    const off = readWebsiteLeadsConfig(base);
    assert.ok(off.enabled && off.notifyEmail === null);
    const bad = readWebsiteLeadsConfig({ ...base, WEBSITE_LEADS_NOTIFY_EMAIL: "a@b.ca, evil@x.com" });
    assert.ok(bad.enabled && bad.notifyEmail === null);
    const on = readWebsiteLeadsConfig({ ...base, WEBSITE_LEADS_NOTIFY_EMAIL: " Team@TAKATAK.ca " });
    assert.ok(on.enabled && on.notifyEmail === "team@takatak.ca");
    const email = leadAlertEmail({
      kind: "package_order", reference: "ABCD1234",
      summary: "Package order: Logo (Basic) · Ref ABCD1234 · $89.00 CAD quoted",
      dashboardOrigin: "https://takatak.ca",
    });
    assert.equal(email.subject, "[takatak.ca] New website order · ABCD1234");
    assert.match(email.text, /https:\/\/takatak\.ca\/dashboard\/leads\/inbox/);
    const route = readFileSync("src/app/api/public/website-requests/route.ts", "utf8");
    assert.match(route, /if \(notifyEmail && !recorded\.duplicate\)/);
    assert.match(route, /after\(async \(\) =>/);
  });

  await check("notification center is workspace-scoped and mark-read stays inside it", async () => {
    assert.deepEqual(visibleTo(CLIENT, null), { OR: [{ clientId: CLIENT }] });
    assert.deepEqual(visibleTo(CLIENT, "p1"), { OR: [{ clientId: CLIENT }, { clientId: null, profileId: "p1" }] });
    assert.equal(linkFor("lead"), "/dashboard/leads/inbox");
    assert.equal(linkFor("javascript:alert(1)"), null);
    assert.equal(linkFor(null), null);
    assert.deepEqual(parseMarkReadBody({ all: true }), { all: true });
    assert.equal(parseMarkReadBody({ all: "yes" }), null);
    assert.equal(parseMarkReadBody({ ids: [] }), null);
    assert.equal(parseMarkReadBody({ ids: ["not-a-uuid"] }), null);
    assert.equal(parseMarkReadBody({ ids: Array(101).fill(CLIENT) }), null);
    assert.deepEqual(parseMarkReadBody({ ids: [CLIENT, CLIENT] }), { ids: [CLIENT] });
    let captured: Record<string, unknown> | null = null;
    const db = {
      notification: {
        async updateMany(args: { where: Record<string, unknown> }) {
          captured = args.where;
          return { count: 1 };
        },
      },
    } as unknown as NotificationsDb;
    await markNotificationsRead(db, { clientId: CLIENT, profileId: null, target: { ids: [CLIENT] } });
    assert.deepEqual(captured, { OR: [{ clientId: CLIENT }], status: "unread", id: { in: [CLIENT] } });
    const api = readFileSync("src/app/api/notifications/read/route.ts", "utf8");
    assert.match(api, /requireWorkspaceApiPermission\("view_dashboard"\)/);
    assert.match(api, /readJsonBody\(request/);
    assert.match(api, /clientId: gate\.access\.activeClientId/);
    const page = readFileSync("src/app/dashboard/notifications/page.tsx", "utf8");
    assert.match(page, /requireWorkspacePermission\("view_dashboard"/);
    assert.doesNotMatch(page, /ModulePlaceholder/);
  });


  await check("hosting requests accept only real plans and become hosting leads", async () => {
    const ok = validateWebsiteRequest({ kind: "hosting_request", planName: "Bronze Hosting", email: "h@example.com" });
    assert.ok(ok.ok);
    if (!ok.ok) return;
    assert.deepEqual(ok.value.hosting, { planName: "Bronze Hosting" });
    for (const planName of ["Free Hosting", "", 42, "bronze hosting"]) {
      assert.equal(validateWebsiteRequest({ kind: "hosting_request", planName, email: "h@example.com" }).ok, false, String(planName));
    }
    const now = new Date();
    const fake = fakeDb(now);
    const recorded = await recordWebsiteRequest(fake.db, {
      clientId: CLIENT, authUserId: null, sourceHash: "h", now, request: ok.value,
    });
    assert.match(String(fake.leads[0].message), /^Hosting request: Bronze Hosting/);
    assert.equal(fake.notifications[0].title, "New hosting request");
    assert.match(recorded.summary, /^Hosting request: Bronze Hosting · Ref /);
  });

  await check("hosting plans fall back to the request form when Upmind cannot load", () => {
    const plans = readFileSync("src/components/website/hosting/upmind-hosting-plans.tsx", "utf8");
    assert.match(plans, /customElements\.get\("upm-widget"\)/);
    assert.match(plans, /if \(widgetsUnavailable\) return <HostingRequestFallback \/>/);
    const form = readFileSync("src/components/website/hosting/HostingRequestFallback.tsx", "utf8");
    assert.match(form, /kind: "hosting_request"/);
    assert.match(form, /name="website"/);
    assert.match(form, /fallback\.hosting\.contactRequired/);
  });

  console.log(`\n${passed} website lead capture checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
