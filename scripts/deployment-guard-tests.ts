import { findHashedPrismaAliases } from "../src/lib/ops/compiled-modules";
import { collectEnvPreflight } from "../src/lib/ops/env-preflight";

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

function main() {
  console.log("[deployment] hashed alias + preflight units");

  const aliases = findHashedPrismaAliases(
    `require("@prisma/client-4e554655281e05c3"); require("@prisma/adapter-pg-2ab9e4e8f21aacc1"); require("@prisma/client");`,
  );
  assert("detects hashed Prisma aliases", aliases.length === 2);
  assert(
    "does not flag the real package name alone",
    findHashedPrismaAliases(`require("@prisma/client")`).length === 0,
  );

  const original = { ...process.env };
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("TWILIO_") ||
      key.startsWith("STRIPE_") ||
      key.startsWith("UPMIND_") ||
      key === "SENDGRID_API_KEY"
    ) {
      delete process.env[key];
    }
  }
  process.env.DATABASE_URL = "postgres://example/db";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SECRET_KEY = "secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://takatak.ca";
  process.env.EMAIL_USER = "otp@takatak.ca";
  process.env.EMAIL_PASSWORD = "app-password";
  const ok = collectEnvPreflight();
  assert("complete essential env passes", ok.missingRequired.length === 0 && ok.ok);

  delete process.env.DATABASE_URL;
  const missing = collectEnvPreflight();
  assert("missing DATABASE_URL is named", missing.missingRequired.includes("DATABASE_URL"));
  assert("values are not printed in names", !JSON.stringify(missing).includes("app-password"));

  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main();
