#!/usr/bin/env node
"use strict";

// PostgREST caches the schema at `supabase start`, before Prisma migrations.
// Reload the cache so Data API tests see the migrated tables, grants, and RLS.

const { Client } = require("pg");

const FORBIDDEN = "pcjfahhlozsseqqevimi";

function fail(message) {
  console.error(`[postgrest-reload] ${message}`);
  process.exit(1);
}

async function main() {
  const haystack = JSON.stringify(process.env);
  if (haystack.includes(FORBIDDEN) || /supabase\.co/i.test(haystack)) {
    fail("hosted Supabase configuration is not allowed during PostgREST reload");
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!connectionString || !url || !anon) {
    fail("DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and anon key are required");
  }
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    fail(`PostgREST URL must be local, got ${url}`);
  }

  const client = new Client({ connectionString, ssl: false });
  await client.connect();
  await client.query("NOTIFY pgrst, 'reload schema'");
  await client.end();
  console.log("[postgrest-reload] sent NOTIFY pgrst, 'reload schema'");

  const deadline = Date.now() + 30_000;
  let lastStatus = 0;
  let lastBody = "";
  while (Date.now() < deadline) {
    const response = await fetch(`${url}/rest/v1/clients?select=id&limit=1`, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Accept: "application/json",
      },
    });
    lastStatus = response.status;
    lastBody = (await response.text()).slice(0, 180);
    if (response.status !== 404) {
      console.log(`[postgrest-reload] clients in schema cache status=${response.status}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  fail(`schema cache still missing clients after reload (status=${lastStatus} body=${lastBody})`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
