// Disposable CI database ONLY; no customer files, provider calls or Stripe charges.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma, disconnectPrisma } from "../src/lib/db/prisma";
import { organizerSettingsFromRow } from "../src/lib/ai-file-organizer/settings-policy";
import { STUDIO_PROJECT_SOURCE } from "../src/lib/studio/production";

async function main() {
  const db = getPrisma();
  if (!db) throw new Error("organizer_db_test_requires_migrated_disposable_database");
  const a = randomUUID(), b = randomUUID(), projectId = randomUUID();
  try {
    await db.client.createMany({ data: [
      { id: a, name: "Organizer CI Tenant A", status: "active" },
      { id: b, name: "Organizer CI Tenant B", status: "active" },
    ] });
    const createdA = await db.organizerWorkspacePolicy.create({ data: { clientId: a } });
    const createdB = await db.organizerWorkspacePolicy.create({ data: { clientId: b } });
    assert.equal(createdA.mode, "off");
    assert.equal(createdA.consentGranted, false);
    assert.equal(createdA.providerProcessingConsent, false);
    assert.equal(createdB.mode, "off");
    await db.savedAiOutput.create({ data: {
      id: projectId, clientId: a, origin: "manual", status: "draft",
      kind: "creative_brief", title: "CI project", content: "{}",
      metadata: { source: STUDIO_PROJECT_SOURCE },
    } });
    const matchA = await db.savedAiOutput.count({ where: {
      id: { in: [projectId] }, clientId: a, status: { not: "archived" },
      metadata: { path: ["source"], equals: STUDIO_PROJECT_SOURCE },
    } });
    const matchB = await db.savedAiOutput.count({ where: {
      id: { in: [projectId] }, clientId: b, status: { not: "archived" },
      metadata: { path: ["source"], equals: STUDIO_PROJECT_SOURCE },
    } });
    assert.equal(matchA, 1);
    assert.equal(matchB, 0, "another tenant cannot authorize this destination");
    const updated = await db.organizerWorkspacePolicy.updateMany({
      where: { clientId: a, revision: 1 },
      data: { mode: "suggest", consentGranted: true, providerProcessingConsent: false,
        allowedSourceKinds: ["studio"], allowedDestinationIds: [projectId],
        minimumConfidence: 0.95, requireApproval: true, revision: { increment: 1 } },
    });
    assert.equal(updated.count, 1);
    const stale = await db.organizerWorkspacePolicy.updateMany({
      where: { clientId: a, revision: 1 }, data: { mode: "off" },
    });
    assert.equal(stale.count, 0, "stale manager revision is rejected");
    const fromA = await db.organizerWorkspacePolicy.findUniqueOrThrow({ where: { clientId: a } });
    const fromB = await db.organizerWorkspacePolicy.findUniqueOrThrow({ where: { clientId: b } });
    assert.equal(organizerSettingsFromRow(fromA).mode, "suggest");
    assert.equal(fromA.revision, 2);
    assert.equal(fromB.revision, 1);
    assert.equal(fromB.consentGranted, false);
    // Fixed trusted SQL string; never accept query parameters for catalog introspection.
    const rls = await db.$queryRawUnsafe<Array<{ relrowsecurity: boolean }>>(
      "SELECT c.relrowsecurity FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='organizer_workspace_policies'"
    );
    assert.equal(rls[0]?.relrowsecurity, true, "workspace policy table RLS must be enabled");
    console.log("AI organizer: ephemeral DB two-tenant, revision, RLS and default-off PASS");
  } finally {
    await db.client.deleteMany({ where: { id: { in: [a, b] } } });
    await disconnectPrisma();
  }
}
void main();
