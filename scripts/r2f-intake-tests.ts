import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readR2FIntakeConfig } from "../src/lib/integrations/r2f/config";
import { verifyR2FRequest } from "../src/lib/integrations/r2f/signature";
import {
  recordR2FLeadWithDb,
  R2FEventConflictError,
  R2FRateLimitedError,
  type R2FLeadStoreDb,
} from "../src/lib/integrations/r2f/store";
import { validateR2FLeadRequest } from "../src/lib/integrations/r2f/validation";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const SECRET = "r2f-test-secret-32-characters-minimum-value";
const INTEGRATION_ID = "r2f-production-test";

function payload(requestId = "r2f-request-0001") {
  return {
    version: 1,
    requestId,
    contact: {
      firstName: "Marie",
      lastName: "Tremblay",
      email: "marie@example.test",
      phone: "514 555 0101",
      preferredLanguage: "fr",
    },
    project: {
      needType: "emergency",
      serviceCategory: "Plomberie",
      serviceSubcategory: "Fuite d'eau",
      problemType: "water_leak",
      market: "residential",
      propertyType: "house",
      urgency: "urgent",
      city: "Montréal",
      postalCode: "H1H 1H1",
      description: "Une conduite fuit sous l'évier depuis ce matin.",
      budgetCents: 50000,
    },
    attribution: {
      sourcePage: "/plombier/montreal",
      referrer: "https://www.google.com/",
      channel: "seo",
      campaign: null,
      utmSource: "google",
      utmMedium: "organic",
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      gclid: null,
      fbclid: null,
      ttclid: null,
    },
    consent: {
      contact: true,
      marketing: false,
      capturedAt: "2026-10-10T08:00:00.000Z",
    },
  };
}

{
  assert.deepEqual(readR2FIntakeConfig({}), { enabled: false });
  assert.deepEqual(
    readR2FIntakeConfig({
      R2F_INTAKE_ENABLED: "true",
      R2F_INTEGRATION_ID: INTEGRATION_ID,
      R2F_INTAKE_WEBHOOK_SECRET: "short",
      R2F_LEADS_CLIENT_ID: CLIENT_ID,
    }),
    { enabled: false },
  );

  const configured = readR2FIntakeConfig({
    R2F_INTAKE_ENABLED: "true",
    R2F_INTEGRATION_ID: INTEGRATION_ID,
    R2F_INTAKE_WEBHOOK_SECRET: SECRET,
    R2F_LEADS_CLIENT_ID: CLIENT_ID,
  });
  assert.equal(configured.enabled, true);
}

{
  const now = Date.UTC(2026, 9, 10, 8, 0, 0);
  const timestamp = String(Math.floor(now / 1000));
  const eventId = "r2f-request-0001";
  const rawBody = JSON.stringify(payload(eventId));
  const signature = createHmac("sha256", SECRET)
    .update(`${timestamp}.${eventId}.${rawBody}`, "utf8")
    .digest("hex");
  const config = {
    enabled: true as const,
    integrationId: INTEGRATION_ID,
    secret: SECRET,
    clientId: CLIENT_ID,
  };

  const headers = new Headers({
    "x-integration-id": INTEGRATION_ID,
    "x-event-id": eventId,
    "x-timestamp": timestamp,
    "x-signature": `sha256=${signature}`,
  });

  assert.deepEqual(verifyR2FRequest(rawBody, headers, config, now), {
    valid: true,
    eventId,
  });

  const bad = new Headers(headers);
  bad.set("x-signature", "sha256=" + "0".repeat(64));
  assert.equal(verifyR2FRequest(rawBody, bad, config, now).valid, false);

  const stale = new Headers(headers);
  stale.set("x-timestamp", String(Math.floor((now - 10 * 60 * 1000) / 1000)));
  assert.equal(verifyR2FRequest(rawBody, stale, config, now).valid, false);
}

{
  const good = validateR2FLeadRequest(payload());
  assert.equal(good.ok, true);

  const missingContact = payload();
  missingContact.contact.email = null;
  missingContact.contact.phone = null;
  const noContact = validateR2FLeadRequest(missingContact);
  assert.equal(noContact.ok, false);
  if (!noContact.ok) assert.equal(noContact.fieldErrors.contactMethod, "required");

  const noConsent = payload();
  noConsent.consent.contact = false as true;
  const consent = validateR2FLeadRequest(noConsent);
  assert.equal(consent.ok, false);
  if (!consent.ok) assert.equal(consent.fieldErrors.contactConsent, "required");

  const badPostal = payload();
  badPostal.project.postalCode = "NOT POSTAL";
  assert.equal(validateR2FLeadRequest(badPostal).ok, false);
}

type AnyRow = Record<string, any>;

function fakeDb(options: { forcedRecentCount?: number } = {}) {
  const sources: AnyRow[] = [];
  const leads: AnyRow[] = [];
  const events: AnyRow[] = [];
  const audits: AnyRow[] = [];
  const notifications: AnyRow[] = [];
  let leadCounter = 1;

  const tx = {
    sourceSynchronizationEvent: {
      findUnique: async ({ where }: AnyRow) =>
        events.find((row) => row.eventId === where.eventId) ?? null,
      create: async ({ data }: AnyRow) => {
        const row = { id: `event-${events.length + 1}`, ...data };
        events.push(row);
        return row;
      },
    },
    leadSource: {
      findFirst: async ({ where }: AnyRow) =>
        sources.find(
          (row) =>
            row.clientId === where.clientId &&
            row.type === where.type &&
            row.name === where.name,
        ) ?? null,
      create: async ({ data }: AnyRow) => {
        const row = { id: "source-r2f", ...data };
        sources.push(row);
        return { id: row.id };
      },
    },
    lead: {
      count: async () => options.forcedRecentCount ?? leads.length,
      findFirst: async ({ where }: AnyRow) =>
        leads.find((row) => {
          if (row.clientId !== where.clientId || row.leadSourceId !== where.leadSourceId) {
            return false;
          }
          if (!String(row.message).startsWith(where.message.startsWith)) return false;
          return (where.OR as AnyRow[]).some(
            (filter) =>
              (filter.email && row.email === filter.email) ||
              (filter.phone && row.phone === filter.phone),
          );
        }) ?? null,
      create: async ({ data }: AnyRow) => {
        const suffix = String(leadCounter++).padStart(12, "0");
        const row = {
          id: `22222222-2222-4222-8222-${suffix}`,
          createdAt: new Date("2026-10-10T08:00:00.000Z"),
          ...data,
        };
        leads.push(row);
        return { id: row.id };
      },
    },
    auditLog: {
      create: async ({ data }: AnyRow) => {
        audits.push(data);
        return data;
      },
    },
    notification: {
      create: async ({ data }: AnyRow) => {
        notifications.push(data);
        return data;
      },
    },
  };

  const db = {
    $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as R2FLeadStoreDb;

  return { db, sources, leads, events, audits, notifications };
}

{
  const valid = validateR2FLeadRequest(payload());
  assert.equal(valid.ok, true);
  if (!valid.ok) throw new Error("fixture_invalid");
  const rawBody = JSON.stringify(payload());
  const fake = fakeDb();

  const first = await recordR2FLeadWithDb(
    fake.db,
    valid.value,
    rawBody,
    CLIENT_ID,
    new Date("2026-10-10T08:00:00.000Z"),
  );

  assert.equal(first.duplicate, false);
  assert.equal(fake.sources.length, 1);
  assert.equal(fake.sources[0].name, "R2F RAPIDE2FIX");
  assert.equal(fake.leads.length, 1);
  assert.equal(fake.leads[0].priority, "high");
  assert.equal(fake.leads[0].metadata.origin, "r2f");
  assert.equal(fake.audits[0].action, "r2f_lead_received");
  assert.equal(fake.notifications.length, 1);
  assert.doesNotMatch(fake.notifications[0].message, /marie@example\.test|514 555|Marie/i);
  assert.equal(fake.events.length, 1);
  assert.equal(fake.events[0].eventId, "r2f:r2f-request-0001");

  const replay = await recordR2FLeadWithDb(
    fake.db,
    valid.value,
    rawBody,
    CLIENT_ID,
    new Date("2026-10-10T08:01:00.000Z"),
  );
  assert.equal(replay.duplicate, true);
  assert.equal(replay.leadId, first.leadId);
  assert.equal(fake.leads.length, 1);
  assert.equal(fake.notifications.length, 1);

  const conflictingBody = rawBody.replace("depuis ce matin", "depuis hier");
  await assert.rejects(
    () =>
      recordR2FLeadWithDb(
        fake.db,
        valid.value,
        conflictingBody,
        CLIENT_ID,
        new Date("2026-10-10T08:02:00.000Z"),
      ),
    R2FEventConflictError,
  );

  const secondPayload = payload("r2f-request-0002");
  const secondValid = validateR2FLeadRequest(secondPayload);
  assert.equal(secondValid.ok, true);
  if (!secondValid.ok) throw new Error("fixture_invalid");
  const contactDuplicate = await recordR2FLeadWithDb(
    fake.db,
    secondValid.value,
    JSON.stringify(secondPayload),
    CLIENT_ID,
    new Date("2026-10-10T08:03:00.000Z"),
  );
  assert.equal(contactDuplicate.duplicate, true);
  assert.equal(fake.leads.length, 1);
  assert.equal(fake.events.length, 2);
}

{
  const valid = validateR2FLeadRequest(payload("r2f-request-flood"));
  assert.equal(valid.ok, true);
  if (!valid.ok) throw new Error("fixture_invalid");

  const fake = fakeDb({ forcedRecentCount: 100 });
  await assert.rejects(
    () =>
      recordR2FLeadWithDb(
        fake.db,
        valid.value,
        JSON.stringify(payload("r2f-request-flood")),
        CLIENT_ID,
      ),
    R2FRateLimitedError,
  );
}

{
  const root = process.cwd();
  const route = readFileSync(
    resolve(root, "src/app/api/v1/integrations/r2f/leads/route.ts"),
    "utf8",
  );
  const existingWebsiteStore = readFileSync(
    resolve(root, "src/lib/website-leads/store.ts"),
    "utf8",
  );

  assert.match(route, /MAXIMUM_BODY_SIZE = 24_000/);
  assert.match(route, /parsed\.value\.requestId !== verification\.eventId/);
  assert.match(route, /"Retry-After": "30"/);
  assert.match(existingWebsiteStore, /WEBSITE_LEAD_SOURCE_NAME = "takatak\.ca website"/);
}

console.log("R2F intake safeguards: PASS");
