#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const requireFromRoot = createRequire(path.join(root, "package.json"));

const modules = [
  "@prisma/client",
  "@prisma/adapter-pg",
  "pg",
  "next",
];

const hashed = [
  "@prisma/client-4e554655281e05c3",
  "@prisma/adapter-pg-2ab9e4e8f21aacc1",
];

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

console.log(`[module-load] clean load from ${root}`);

for (const id of modules) {
  try {
    requireFromRoot(id);
    assert(`resolves ${id}`, true);
  } catch (error) {
    assert(
      `resolves ${id}`,
      false,
      error instanceof Error ? error.message : "unknown",
    );
  }
}

for (const id of hashed) {
  let resolved = false;
  try {
    requireFromRoot.resolve(id);
    resolved = true;
  } catch {
    resolved = false;
  }
  assert(
    `hashed alias ${id} is not installed`,
    !resolved,
    "compatibility alias must not be required",
  );
}

const nextServer = path.join(root, ".next", "server");
assert("compiled server output exists", fs.existsSync(nextServer));

if (failed > 0) {
  process.exit(1);
}
