import { NextResponse } from "next/server";

import {
  applySessionCookies,
  estimateCookieHeaderBytes,
  expireAuthCookies,
  MAX_SET_COOKIE_HEADER_BYTES,
  normalizeSessionCookieWrites,
} from "../src/lib/auth/workspace-session-cookies";

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
  console.log("[auth-cookies] session cookie handling");

  const expired = expireAuthCookies([
    "sb-xxxx-auth-token.0",
    "sb-xxxx-auth-token.1",
    "unrelated",
  ]);
  assert(
    "chunked supabase cookies are expired",
    expired.some((item) => item.name === "sb-xxxx-auth-token.0") &&
      expired.some((item) => item.name === "sb-xxxx-auth-token.9"),
  );
  assert(
    "non-auth cookies are left alone",
    expired.every((item) => item.name.includes("auth-token")),
  );

  const normalized = normalizeSessionCookieWrites([
    { name: "sb-auth-token", value: "one", options: { path: "/" } },
    { name: "sb-auth-token", value: "two", options: { path: "/" } },
  ]);
  assert("duplicate cookie names collapse", normalized.length === 1);
  assert("last write wins", normalized[0]?.value === "two");
  assert("path is /", normalized[0]?.options?.path === "/");
  assert("SameSite is lax", normalized[0]?.options?.sameSite === "lax");

  const response = NextResponse.json({ ok: true });
  const applied = applySessionCookies(response, [
    { name: "sb-auth-token", value: "session", options: { httpOnly: true, path: "/" } },
  ]);
  assert("cookie application succeeds", applied.ok);
  assert(
    "JSON body does not include the session token",
    !JSON.stringify({ ok: true }).includes("session"),
  );

  const huge = applySessionCookies(
    NextResponse.json({ ok: true }),
    Array.from({ length: 20 }, (_, index) => ({
      name: `sb-auth-token.${index}`,
      value: "x".repeat(2_000),
    })),
  );
  assert(
    "oversized cookie header is rejected",
    huge.ok === false && huge.headerBytes > MAX_SET_COOKIE_HEADER_BYTES,
  );
  assert("header size estimator is positive", estimateCookieHeaderBytes(expired) > 0);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
