#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import {
  CRITICAL_ROUTE_HINTS,
  scanDirectoryForHashedPrismaAliases,
  schemaChecksum,
} from "../src/lib/ops/compiled-modules";

const root = process.cwd();
const nextDir = path.join(root, ".next");
let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

console.log("[compiled-modules] Prisma alias and schema checks");

assert(".next exists", fs.existsSync(nextDir), "run the production webpack build first");

if (fs.existsSync(nextDir)) {
  const hits = scanDirectoryForHashedPrismaAliases(nextDir);
  assert(
    "compiled output has no hashed Prisma package aliases",
    hits.length === 0,
    hits
      .slice(0, 5)
      .map((hit) => `${hit.file}: ${hit.aliases.join(",")}`)
      .join("; "),
  );
}

const schemaPath = path.join(root, "prisma", "schema.prisma");
assert("canonical prisma/schema.prisma exists", fs.existsSync(schemaPath));
assert(
  "prisma/generated/schema.prisma is not treated as source",
  !fs.existsSync(path.join(root, "prisma", "generated", "schema.prisma")) ||
    fs.existsSync(schemaPath),
);

if (fs.existsSync(schemaPath)) {
  const expected = schemaChecksum(schemaPath);
  const stampPath = path.join(root, "prisma", ".generated-schema.sha256");
  if (fs.existsSync(stampPath)) {
    const actual = fs.readFileSync(stampPath, "utf8").trim();
    assert("generated Prisma client matches schema checksum", actual === expected);
  } else if (process.env.CI === "true") {
    assert("generated Prisma checksum stamp exists", false, stampPath);
  } else {
    console.log("  SKIP generated checksum stamp is not present yet");
  }
}

for (const hint of CRITICAL_ROUTE_HINTS) {
  console.log(`  INFO critical route hint: ${hint}`);
}

if (failed > 0) {
  process.exit(1);
}
