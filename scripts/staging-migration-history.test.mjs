import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeployApprovedPending,
  migrationHistorySlug,
  supabaseHistorySql,
} from "./staging-migration-history.mjs";

test("numeric migration prefix is removed once", () => {
  assert.equal(
    migrationHistorySlug("20261003063500_hockey_parent_team_preferences"),
    "hockey_parent_team_preferences",
  );
  assert.equal(
    migrationHistorySlug("20261008090000_website_lead_attachments"),
    "website_lead_attachments",
  );
});

test("a doubled backslash in the prefix pattern does not match a real name", () => {
  const name = "20261003063500_hockey_parent_team_preferences";
  assert.equal(name.replace(/^\\d+_/, ""), name);
  assert.notEqual(migrationHistorySlug(name), name);
});

test("Supabase statement arrays join with a real newline", () => {
  const statements = ["select 1;", "select 2;"];
  assert.equal(supabaseHistorySql(statements), "select 1;\nselect 2;");
  assert.notEqual(statements.join("\\n"), "select 1;\nselect 2;");
});

test("a missing statement list becomes empty SQL", () => {
  assert.equal(supabaseHistorySql(null), "");
  assert.equal(supabaseHistorySql(undefined), "");
  assert.equal(supabaseHistorySql("select 1;"), "");
});

test("deploy runs only when every pending migration is approved", () => {
  assert.equal(
    canDeployApprovedPending({ pendingAfterResolve: ["20261009010000_growth"], unrelatedPending: [] }),
    true,
  );
  assert.equal(
    canDeployApprovedPending({
      pendingAfterResolve: ["20261009010000_growth"],
      unrelatedPending: ["20261009100000_not_approved"],
    }),
    false,
  );
  assert.equal(canDeployApprovedPending({ pendingAfterResolve: [], unrelatedPending: [] }), false);
  assert.equal(canDeployApprovedPending({}), false);
});
