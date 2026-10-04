import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  contributionBadge,
  contributionPriority,
  contributionReviewDueAt,
  contributionSlaLabel,
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
assert.match(env, /AHMV_CONTRIBUTION_MODERATOR_EMAIL=OHMVVerdun\.ca@gmail\.com/);

console.log("TAKATAK community content moderation safeguards passed.");
