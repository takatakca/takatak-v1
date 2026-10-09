import assert from "node:assert/strict";
import { phoneEmailHistoryDecision } from "./phone-email-history.mjs";

const repoSql = 'ALTER TABLE "profiles" ALTER COLUMN "email" DROP NOT NULL;';
const historySql = "alter table profiles alter column email drop not null;";

assert.deepEqual(
  phoneEmailHistoryDecision({
    nullable: false,
    historySql,
    repoSql,
    alreadyRecorded: false,
  }).action,
  "refuse",
);
assert.equal(
  phoneEmailHistoryDecision({
    nullable: true,
    historySql: "",
    repoSql,
    alreadyRecorded: false,
  }).action,
  "refuse",
);
assert.equal(
  phoneEmailHistoryDecision({
    nullable: true,
    historySql: "select 1;",
    repoSql,
    alreadyRecorded: false,
  }).action,
  "refuse",
);
assert.equal(
  phoneEmailHistoryDecision({
    nullable: true,
    historySql,
    repoSql,
    alreadyRecorded: true,
  }).action,
  "noop",
);
assert.equal(
  phoneEmailHistoryDecision({
    nullable: true,
    historySql,
    repoSql,
    alreadyRecorded: false,
  }).action,
  "resolve",
);

console.log("[phone-email-history] passed");
