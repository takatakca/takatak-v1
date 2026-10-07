import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  contributorBadge,
  contributionPatchPolicy,
  contributionPriority,
  contributionReviewDueAt,
  contributionSlaLabel,
  earnedMembershipWeekMilestones,
  publicationMayBeQueued,
  requiresOfficialSourceVerification,
} from "../src/lib/contributions/policy";
import { screenContribution } from "../src/lib/contributions/screening";

const now = new Date("2026-10-04T16:00:00.000Z");

assert.equal(contributionPriority("member"), "member_priority");
assert.equal(contributionPriority("registered"), "standard");
assert.equal(contributionPriority("guest"), "standard");
assert.equal(contributionSlaLabel("member"), "48 hours");
assert.equal(contributionSlaLabel("guest"), "1–7 days");
assert.equal(
  contributionReviewDueAt(now, "member").toISOString(),
  "2026-10-06T16:00:00.000Z",
);
assert.equal(
  contributionReviewDueAt(now, "guest").toISOString(),
  "2026-10-11T16:00:00.000Z",
);

assert.equal(requiresOfficialSourceVerification("schedule"), true);
assert.equal(requiresOfficialSourceVerification("arena"), false);
assert.equal(
  publicationMayBeQueued({
    resourceType: "schedule",
    moderatorConfirmedOfficialSource: false,
  }),
  false,
);
assert.equal(
  publicationMayBeQueued({
    resourceType: "schedule",
    moderatorConfirmedOfficialSource: true,
  }),
  true,
);
assert.equal(
  publicationMayBeQueued({
    resourceType: "photo",
    moderatorConfirmedOfficialSource: false,
  }),
  true,
);

assert.equal(
  contributorBadge({ points: 0, approvedCount: 0, publishedCount: 0 }),
  "new_contributor",
);
assert.equal(
  contributorBadge({ points: 50, approvedCount: 5, publishedCount: 2 }),
  "community_helper",
);
assert.equal(
  contributorBadge({ points: 250, approvedCount: 20, publishedCount: 12 }),
  "trusted_contributor",
);
assert.equal(
  contributorBadge({ points: 750, approvedCount: 50, publishedCount: 35 }),
  "community_expert",
);
assert.equal(earnedMembershipWeekMilestones(249), 0);
assert.equal(earnedMembershipWeekMilestones(250), 1);
assert.equal(earnedMembershipWeekMilestones(750), 3);
assert.equal(earnedMembershipWeekMilestones(1500), 7);

const arenaPatch = contributionPatchPolicy({
  resourceType: "arena",
  patch: {
    address: "4110 boulevard LaSalle",
    phone: "514-555-0100",
    photoUrl: "https://cdn.example.test/arena.jpg",
  },
});
assert.equal(arenaPatch.valid, true);

const localizedArenaPatch = contributionPatchPolicy({
  resourceType: "arena",
  patch: {
    "description.fr": "Nouvelle description vérifiée",
    "directionsNotes.fr": "Utiliser la porte arrière sur la rue Exemple",
  },
});
assert.equal(localizedArenaPatch.valid, true);

const photoPatch = contributionPatchPolicy({
  resourceType: "photo",
  patch: {
    url: "https://cdn.example.test/new-photo.jpg",
    "alt.fr": "Nouvelle description de la photo",
    "label.fr": "Nouvelle légende",
  },
});
assert.equal(photoPatch.valid, true);

const protectedTeamIdentity = contributionPatchPolicy({
  resourceType: "team",
  patch: {
    "publicTeamId.value": "do-not-change",
    category: "M99",
    description: "Useful external description correction",
  },
});
assert.equal(protectedTeamIdentity.valid, false);
assert.deepEqual(
  protectedTeamIdentity.protectedFields.sort(),
  ["category", "publicTeamId.value"],
);

const teamExternalContent = contributionPatchPolicy({
  resourceType: "team",
  patch: {
    description: "Updated external description",
    heroImageUrl: "https://cdn.example.test/team.jpg",
    socialLinks: ["https://facebook.com/example"],
  },
});
assert.equal(teamExternalContent.valid, true);

const scheduleNoEvidence = screenContribution({
  idempotencyKey: "schedule-1",
  resourceType: "schedule",
  resourceKey: "event:abc",
  action: "correct_fact",
  proposedPatch: { start: "21:30" },
  evidenceUrls: [],
});
assert.equal(scheduleNoEvidence.status, "flagged");
assert.ok(scheduleNoEvidence.flags.includes("official_source_evidence_required"));

const validArenaPhoto = screenContribution({
  idempotencyKey: "arena-photo-1",
  resourceType: "photo",
  resourceKey: "arena:auditorium-de-verdun:hero",
  action: "replace_media",
  proposedPatch: { alt: "Auditorium de Verdun" },
  attachmentUrls: ["https://cdn.example.test/auditorium.jpg"],
  evidenceUrls: ["https://montreal.ca/lieux/auditorium-de-verdun"],
});
assert.equal(validArenaPhoto.status, "passed");

const unsafe = screenContribution({
  idempotencyKey: "unsafe-1",
  resourceType: "news",
  resourceKey: "news:test",
  action: "update",
  targetUrl: "http://insecure.example.test",
  proposedPatch: { token: "secret-value" },
});
assert.equal(unsafe.status, "flagged");
assert.ok(unsafe.flags.includes("unsafe_target_url"));
assert.ok(unsafe.flags.includes("possible_sensitive_information"));

const authSource = readFileSync("src/lib/contributions/ahmv-auth.ts", "utf8");
const serviceSource = readFileSync("src/lib/contributions/service.ts", "utf8");
const migration = readFileSync(
  "prisma/migrations/20261004190000_community_content_moderation/migration.sql",
  "utf8",
);
const env = readFileSync(".env.example", "utf8");

assert.match(authSource, /TAKATAK_AHMV_CONTENT_TOKEN/);
assert.doesNotMatch(authSource, /TAKATAK_AHMV_INGEST_TOKEN/);
assert.match(serviceSource, /getHockeyMembershipSnapshot/);
assert.match(serviceSource, /member_priority/);
assert.match(serviceSource, /sendModeratorEmail/);
assert.match(serviceSource, /publicationMayBeQueued/);
assert.match(serviceSource, /moderatorProfileId/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
assert.match(migration, /content_publications/);
assert.match(migration, /contributor_reputations/);
assert.match(migration, /contribution_reward_ledger/);
assert.match(env, /AHMV_CONTRIBUTION_MODERATOR_EMAIL=OHMVVerdun\.ca@gmail\.com/);

async function verifyModerationQueue() {
  type QueueRow = {
    id: string;
    clientId: string;
    publisherCode: string;
    status: string;
    priority: string;
    reviewDueAt: Date;
    createdAt: Date;
  };
  type QueueOptions = { clientId: string; publisherCode?: string; status?: string; limit?: number };
  type QueueQuery = {
    where: Partial<QueueRow>;
    orderBy: Array<Partial<Record<keyof QueueRow, "asc" | "desc">>>;
    take: number;
  };
  const fixture = (id: string, priority: string, due: string, created: string, scope: Partial<QueueRow> = {}): QueueRow => ({
    id, priority, reviewDueAt: new Date(due), createdAt: new Date(created),
    clientId: "fixture-client", publisherCode: "AHMV", status: "pending_review", ...scope,
  });
  let rows: QueueRow[] = [
    fixture("standard-overdue", "standard", "2026-01-01", "2025-12-01"),
    fixture("member-later-due", "member_priority", "2026-10-09", "2026-09-01"),
    fixture("member-newer", "member_priority", "2026-10-08", "2026-10-04"),
    fixture("member-older", "member_priority", "2026-10-08", "2026-10-01"),
    fixture("other-client", "member_priority", "2026-01-01", "2025-12-01", { clientId: "other-client" }),
    fixture("other-publisher", "member_priority", "2026-01-01", "2025-12-01", { publisherCode: "OTHER" }),
    fixture("changes-requested", "member_priority", "2026-01-01", "2025-12-01", { status: "changes_requested" }),
    fixture("already-approved", "member_priority", "2026-01-01", "2025-12-01", { status: "approved" }),
  ];
  let available = true;
  const prismaFixture = {
    contentContribution: {
      async findMany(query: QueueQuery) {
        // Model the database contract: filtering and ordering happen before SQL LIMIT.
        return rows.filter((row) => Object.entries(query.where).every(([key, value]) => row[key as keyof QueueRow] === value))
          .sort((left, right) => {
            for (const order of query.orderBy) {
              const [key, direction] = Object.entries(order)[0]!;
              const a = left[key as keyof QueueRow];
              const b = right[key as keyof QueueRow];
              const comparison = a instanceof Date && b instanceof Date
                ? a.getTime() - b.getTime()
                : String(a).localeCompare(String(b));
              if (comparison) return direction === "asc" ? comparison : -comparison;
            }
            return 0;
          }).slice(0, query.take);
      },
    },
  };

  // Exercise the production function in isolation without importing DB, billing or providers.
  const source = ts.createSourceFile("service.ts", serviceSource, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "listModerationQueue");
  assert.ok(declaration, "Production listModerationQueue must be present");
  const isolated: { listModerationQueue?: (options: QueueOptions) => Promise<QueueRow[]> } = {};
  runInNewContext(ts.transpileModule(declaration.getText(source), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: isolated, getPrisma: () => available ? prismaFixture : null });
  assert.ok(isolated.listModerationQueue);
  const listQueue = isolated.listModerationQueue;
  const scope = { clientId: "fixture-client", publisherCode: "AHMV" };

  assert.deepEqual((await listQueue({ ...scope, limit: 1 })).map((row) => row.id), ["member-older"], "Member priority must be selected before take, even when standard work is older and overdue");
  assert.deepEqual((await listQueue({ ...scope, limit: 2 })).map((row) => row.id), ["member-older", "member-newer"], "Due date then age must break member-priority ties");
  assert.deepEqual((await listQueue(scope)).map((row) => row.id), ["member-older", "member-newer", "member-later-due", "standard-overdue"], "Other clients, publishers and non-pending statuses must stay outside this queue");
  assert.deepEqual((await listQueue({ ...scope, status: "changes_requested" })).map((row) => row.id), ["changes-requested"], "Explicit status selection must remain supported");
  assert.equal((await listQueue({ clientId: scope.clientId, limit: 1 }))[0]?.id, "other-publisher", "Omitting publisher must preserve the caller's client-wide queue");
  assert.deepEqual((await listQueue({ ...scope, limit: 0 })).map((row) => row.id), ["member-older"]);

  rows = Array.from({ length: 215 }, (_, index) => fixture(`bounded-${index}`, "standard", "2026-10-08", "2026-10-01"));
  assert.equal((await listQueue(scope)).length, 100, "Default page size must remain bounded");
  assert.equal((await listQueue({ ...scope, limit: 999 })).length, 200, "Requested page size must retain its maximum bound");
  available = false;
  assert.equal((await listQueue(scope)).length, 0, "Unavailable DB must retain the existing empty queue fallback");
}

void verifyModerationQueue().then(() => {
  console.log("TAKATAK community content moderation safeguards passed.");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
