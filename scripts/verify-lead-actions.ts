// Lead detail actions — parsing, history and workspace scoping (no network, no DB).
// Run: npm run qa:lead-actions
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyLeadUpdate, parseLeadUpdate, type LeadActionsDb } from "../src/lib/leads/lead-actions";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const LEAD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

type Row = Record<string, unknown>;
function fakeDb(lead: Row) {
  const activities: Row[] = [];
  const audits: Row[] = [];
  const tx = {
    lead: {
      async findFirst({ where }: { where: { id: string; clientId: string } }) {
        return where.id === lead.id && where.clientId === lead.clientId ? { ...lead } : null;
      },
      async update({ data }: { data: Row }) {
        Object.assign(lead, data);
        return lead;
      },
    },
    leadActivity: {
      async create({ data }: { data: Row }) {
        activities.push(data);
        return data;
      },
    },
    auditLog: {
      async create({ data }: { data: Row }) {
        audits.push(data);
        return data;
      },
    },
  };
  const db = { $transaction: <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx) } as unknown as LeadActionsDb;
  return { db, lead, activities, audits };
}

function newLead(): Row {
  return { id: LEAD, clientId: CLIENT, status: "new_internal", priority: "normal", followUpAt: null, businessBrandId: null };
}

async function main() {
  console.log("Lead action checks");

  await check("only known statuses, priorities, real dates and bounded notes are accepted", () => {
    assert.deepEqual(parseLeadUpdate({ status: "contacted_internal" }), { status: "contacted_internal" });
    assert.deepEqual(parseLeadUpdate({ followUpOn: "2026-10-20", note: "  Called  " }), { followUpOn: "2026-10-20", note: "Called" });
    assert.deepEqual(parseLeadUpdate({ followUpOn: null }), { followUpOn: null });
    for (const bad of [
      null, [], {}, { status: "deleted" }, { priority: "critical" }, { followUpOn: "20-10-2026" },
      { followUpOn: "2026-13-45" }, { note: 5 }, { note: "x".repeat(2001) }, { note: "   " },
    ]) {
      assert.equal(parseLeadUpdate(bad), null, JSON.stringify(bad));
    }
  });

  await check("a status change updates the lead and writes history and audit", async () => {
    const fake = fakeDb(newLead());
    const now = new Date("2026-10-06T15:00:00Z");
    const result = await applyLeadUpdate(fake.db, { clientId: CLIENT, leadId: LEAD, profileId: "p1", update: { status: "contacted_internal" }, now });
    assert.deepEqual(result, { ok: true, changes: ["status"] });
    assert.equal(fake.lead.status, "contacted_internal");
    assert.equal(fake.activities[0].type, "status_change");
    assert.match(String(fake.activities[0].title), /New \(internal only\) → Contacted \(internal only\)/);
    assert.deepEqual(fake.activities[0].metadata, { actorProfileId: "p1", source: "lead_detail" });
    assert.equal(fake.audits[0].action, "lead_updated");
    assert.equal(fake.audits[0].profileId, "p1");
  });

  await check("unchanged values write nothing; notes and follow-ups are recorded", async () => {
    const fake = fakeDb(newLead());
    const same = await applyLeadUpdate(fake.db, { clientId: CLIENT, leadId: LEAD, profileId: null, update: { status: "new_internal", priority: "normal", followUpOn: null } });
    assert.deepEqual(same, { ok: true, changes: [] });
    assert.equal(fake.activities.length + fake.audits.length, 0);

    await applyLeadUpdate(fake.db, { clientId: CLIENT, leadId: LEAD, profileId: null, update: { followUpOn: "2026-10-20", note: "Sent quote" } });
    assert.equal((fake.lead.followUpAt as Date).toISOString(), "2026-10-20T12:00:00.000Z");
    assert.deepEqual(fake.activities.map((a) => a.type), ["follow_up", "note"]);
    assert.equal(fake.activities[1].note, "Sent quote");

    await applyLeadUpdate(fake.db, { clientId: CLIENT, leadId: LEAD, profileId: null, update: { followUpOn: "2026-10-20" } });
    assert.equal(fake.activities.length, 2, "same follow-up day is not recorded twice");

    await applyLeadUpdate(fake.db, { clientId: CLIENT, leadId: LEAD, profileId: null, update: { followUpOn: null } });
    assert.equal(fake.lead.followUpAt, null);
    assert.equal(fake.activities[2].status, "cancelled");
  });

  await check("a lead from another workspace is not found and nothing is written", async () => {
    const fake = fakeDb(newLead());
    const result = await applyLeadUpdate(fake.db, { clientId: OTHER, leadId: LEAD, profileId: null, update: { status: "won_internal", note: "x" } });
    assert.deepEqual(result, { ok: false, reason: "not_found" });
    assert.equal(fake.lead.status, "new_internal");
    assert.equal(fake.activities.length + fake.audits.length, 0);
  });

  await check("route and page require an editing role in the active workspace", () => {
    const route = readFileSync("src/app/api/leads/[id]/route.ts", "utf8");
    assert.match(route, /requireWorkspaceApiPermission\("edit_content"\)/);
    assert.match(route, /readJsonBody\(request/);
    assert.match(route, /clientId: gate\.access\.activeClientId/);
    const page = readFileSync("src/app/dashboard/leads/[id]/page.tsx", "utf8");
    assert.match(page, /access\.mode === "client_scoped" && hasEffectivePermission\(access, "edit_content"\)/);
    assert.match(page, /\{canEdit \? \(/);
  });

  console.log(`\n${passed} lead action checks passed.`);
}

void main();
