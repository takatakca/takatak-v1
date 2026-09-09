#!/usr/bin/env tsx
import { collectEnvPreflight } from "../src/lib/ops/env-preflight";

const result = collectEnvPreflight();
const missing = result.missingRequired;
const invalid = result.invalid;

console.log("TAKATAK production preflight (names only — never values)");
console.log("required missing:", missing.length ? missing.join(", ") : "none");
console.log("invalid or incomplete:", invalid.length ? invalid.join(", ") : "none");

if (!result.ok) {
  console.error("Preflight failed.");
  process.exit(1);
}

console.log("Preflight passed.");
