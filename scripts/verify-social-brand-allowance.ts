/**
 * Isolated checks for Brand freeze / restore and blocked_by_plan posts.
 * No database. Exit 1 on mismatch.
 */

import {
  effectiveBrandAllowance,
  isKeepSelectionValid,
  planBrandFreeze,
  planScheduledPostBlocks,
} from "../src/lib/billing/social/brand-allowance-policy";

type Row = { name: string; ok: boolean; detail: string };

const rows: Row[] = [];

function check(name: string, ok: boolean, detail: string) {
  rows.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`${name}: ${detail}`);
  }
}

function main() {
  const brands = [
    { id: "a", createdAt: "2026-01-01", status: "active" },
    { id: "b", createdAt: "2026-02-01", status: "active" },
    { id: "c", createdAt: "2026-03-01", status: "active" },
  ];

  const over = planBrandFreeze(brands, 1, null);
  check(
    "three Brands on Free needs a choice",
    over.overAllowance &&
      over.needsSelection &&
      over.defaultKeepIds[0] === "a" &&
      over.freezeIds.includes("b") &&
      over.freezeIds.includes("c"),
    "oldest Brand should stay by default",
  );

  const picked = planBrandFreeze(brands, 1, ["c"]);
  check(
    "owner can keep a newer Brand",
    picked.defaultKeepIds[0] === "c" &&
      picked.freezeIds.includes("a") &&
      picked.freezeIds.includes("b") &&
      !picked.needsSelection,
    "keepIds must override oldest-first",
  );

  check(
    "keep selection validates cap",
    isKeepSelectionValid(brands, 1, ["c"]) &&
      !isKeepSelectionValid(brands, 1, ["a", "b"]) &&
      !isKeepSelectionValid(brands, 1, ["missing"]),
    "more than the allowance or unknown ids must fail",
  );

  const restore = planBrandFreeze(
    [
      { id: "a", createdAt: "2026-01-01", status: "active" },
      { id: "b", createdAt: "2026-02-01", status: "frozen" },
      { id: "c", createdAt: "2026-03-01", status: "frozen" },
    ],
    5,
    null,
  );
  check(
    "upgrade restores frozen Brands",
    restore.canAutoRestore &&
      restore.restoreIds.includes("b") &&
      restore.restoreIds.includes("c") &&
      restore.freezeIds.length === 0,
    "spare slots should unfreeze oldest first",
  );

  check(
    "blocked access freezes every live Brand",
    effectiveBrandAllowance("blocked", 25) === 0 &&
      effectiveBrandAllowance("blocked", 1, "missing") === 1 &&
      effectiveBrandAllowance("free", 1) === 1,
    "suspended is 0; missing row still gets Free allowance",
  );

  const blocked = planScheduledPostBlocks({
    frozenBrandIds: ["b"],
    monthlyPostAllowance: 2,
    posts: [
      {
        id: "p1",
        brandId: "a",
        status: "scheduled",
        scheduledAt: "2026-09-01",
      },
      {
        id: "p2",
        brandId: "a",
        status: "scheduled",
        scheduledAt: "2026-09-02",
      },
      {
        id: "p3",
        brandId: "a",
        status: "scheduled",
        scheduledAt: "2026-09-03",
      },
      {
        id: "p4",
        brandId: "b",
        status: "scheduled",
        scheduledAt: "2026-09-01",
      },
      {
        id: "p5",
        brandId: "a",
        status: "draft",
        scheduledAt: null,
      },
    ],
  });
  check(
    "frozen Brand posts and over-quota scheduled posts block",
    blocked.includes("p4") &&
      blocked.includes("p3") &&
      !blocked.includes("p1") &&
      !blocked.includes("p2") &&
      !blocked.includes("p5"),
    "keep earliest two live scheduled posts; freeze Brand b; ignore drafts",
  );

  check(
    "unlimited publishing only blocks frozen Brands",
    planScheduledPostBlocks({
      frozenBrandIds: ["b"],
      monthlyPostAllowance: null,
      posts: [
        {
          id: "p1",
          brandId: "a",
          status: "scheduled",
          scheduledAt: "2026-09-01",
        },
        {
          id: "p4",
          brandId: "b",
          status: "scheduled",
          scheduledAt: "2026-09-01",
        },
      ],
    }).join(",") === "p4",
    "paid unlimited must not quota-block live Brands",
  );

  console.log("Social brand allowance verification");
  console.log("===================================");
  for (const row of rows) {
    console.log(`${row.ok ? "PASS" : "FAIL"}  ${row.name}`);
    console.log(`      ${row.detail}`);
  }
  console.log("");
  console.log(
    `Result: ${rows.every((r) => r.ok) ? "ALL PASS" : "FAILED"} (${rows.length} checks)`,
  );
}

try {
  main();
} catch (error) {
  console.error("FAIL", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
