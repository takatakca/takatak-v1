#!/usr/bin/env node
"use strict";

const FORBIDDEN = "pcjfahhlozsseqqevimi";

function fail(message) {
  console.error(`[ephemeral-guard] ${message}`);
  process.exit(1);
}

const haystack = [
  JSON.stringify(process.env),
  process.env.DATABASE_URL || "",
  process.env.DIRECT_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  process.env.SUPABASE_SECRET_KEY || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
].join("\n");

if (haystack.includes(FORBIDDEN)) {
  fail(`hosted Supabase project ref ${FORBIDDEN} appeared in the ephemeral-test environment`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (/supabase\.co/i.test(url)) {
  fail(`NEXT_PUBLIC_SUPABASE_URL points at hosted Supabase: ${url}`);
}

if (!/localhost|127\.0\.0\.1/.test(url) && process.env.EPHEMERAL_SUPABASE === "1") {
  fail(`ephemeral stack URL must be local, got ${url || "(empty)"}`);
}

const databaseUrl = process.env.DATABASE_URL || "";
if (/pooler\.supabase\.com|db\.[a-z0-9]+\.supabase\.co/i.test(databaseUrl)) {
  fail("DATABASE_URL points at hosted Supabase");
}

console.log("[ephemeral-guard] no hosted project ref or supabase.co URL in ephemeral env");
