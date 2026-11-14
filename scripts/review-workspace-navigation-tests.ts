import assert from "node:assert/strict";
import {
  reviewApprovalHash,
  reviewApprovalTarget,
  reviewSectionFromHash,
  reviewTreatmentForRecord,
} from "../src/lib/reputation/workspace-navigation";

const reviewId = "11111111-1111-4111-8111-111111111111";
const otherReviewId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const otherRunId = "44444444-4444-4444-8444-444444444444";
type Treatment = {
  id: string;
  reviewId: string | null;
  source: "google" | "qmaps" | "takatak";
  author: string;
  createdAt: string;
};
const run: Treatment = {
  id: runId,
  reviewId,
  source: "google",
  author: "Synthetic shared reviewer",
  createdAt: "2026-11-06T12:00:00.000Z",
};
const googleReview = { id: reviewId, source: "google", origin: "external" as const };
let count = 0;
function check(name: string, verify: () => void) {
  verify();
  count++;
  console.log("PASS", name);
}

check("inbox opens the exact source and persisted review, despite identical reviewer names", () => {
  const sameAuthorOtherReview: Treatment = {
    ...run,
    id: otherRunId,
    reviewId: otherReviewId,
    createdAt: "2026-11-06T14:00:00.000Z",
  };
  const sameIdOtherSource: Treatment = { ...run, source: "qmaps" };
  assert.equal(
    reviewTreatmentForRecord(googleReview, [sameAuthorOtherReview, sameIdOtherSource, run]),
    run,
  );
  assert.equal(reviewTreatmentForRecord(googleReview, [sameAuthorOtherReview, sameIdOtherSource]), null);
});

check("first-party and QMAPS treatment links use their own persisted identities", () => {
  for (const [source, origin] of [["takatak", "feedback"], ["qmaps", "listing"]] as const) {
    const sourceRun: Treatment = { ...run, source };
    assert.equal(reviewTreatmentForRecord({ id: reviewId, source, origin }, [run, sourceRun]), sourceRun);
  }
});

check("unsupported imports, mismatched origins and unavailable review targets cannot borrow a treatment", () => {
  assert.equal(reviewTreatmentForRecord({ id: reviewId, source: "trustpilot", origin: "listing" }, [run]), null);
  assert.equal(reviewTreatmentForRecord({ id: reviewId, source: "google", origin: "listing" }, [run]), null);
  assert.equal(reviewTreatmentForRecord(googleReview, [{ ...run, reviewId: null }]), null);
});

check("the latest exact review treatment is deterministic without reordering the caller's queue", () => {
  const older = { ...run, createdAt: "2026-11-05T12:00:00.000Z" };
  const latest = { ...run, id: otherRunId };
  const queue = [older, latest, run];
  const before = [...queue];
  assert.equal(reviewTreatmentForRecord(googleReview, queue), latest);
  assert.equal(reviewTreatmentForRecord(googleReview, [...queue].reverse()), latest);
  assert.deepEqual(queue, before);
});

check("an exact run deep link round-trips and retains a valid unknown target for explicit unavailable handling", () => {
  assert.deepEqual(reviewApprovalTarget(reviewApprovalHash(runId)), { requested: true, runId });
  const unknownUppercase = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
  assert.deepEqual(reviewApprovalTarget(reviewApprovalHash(unknownUppercase)), {
    requested: true,
    runId: unknownUppercase.toLowerCase(),
  });
  assert.equal(reviewSectionFromHash(reviewApprovalHash(runId)), "approvals");
});

check("malformed and duplicate exact-run targets never become an unrequested generic queue", () => {
  for (const hash of [
    "#review-approvals?run=",
    "#review-approvals?run=not-a-run",
    "#review-approvals?run=%3Cscript%3E",
    `#review-approvals?run=${runId}&run=${runId}`,
    `#review-approvals?run=${runId}&run=${otherRunId}`,
  ]) {
    assert.deepEqual(reviewApprovalTarget(hash), { requested: true, runId: null });
  }
});

check("ordinary studio entry and other sections cannot carry an accidental focused treatment", () => {
  for (const hash of [reviewApprovalHash(), "#review-approvals?layout=grid", `#review-inbox?run=${runId}`, `#first-party-feedback?run=${runId}`]) {
    assert.deepEqual(reviewApprovalTarget(hash), { requested: false, runId: null });
  }
});

check("native workspace sections and the existing first-party follow-up alias remain reachable", () => {
  for (const [hash, section] of [
    ["#review-inbox", "inbox"],
    ["#review-approvals", "approvals"],
    ["#review-requests", "requests"],
    ["#first-party-feedback", "requests"],
    ["#review-import", "import"],
    ["#review-connections", "connections"],
  ]) assert.equal(reviewSectionFromHash(hash), section);
  assert.equal(reviewSectionFromHash("#unrelated"), undefined);
});

console.log(`Review workspace navigation: ${count} checks passed.`);
