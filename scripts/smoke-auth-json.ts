#!/usr/bin/env tsx
/**
 * JSON-contract smoke tests. Point SMOKE_BASE_URL at staging.
 * Never uses a real customer account.
 */
const base = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const smokeOrigin = process.env.SMOKE_ORIGIN ?? base;

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

async function post(path: string, body: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: smokeOrigin,
    },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, contentType, text, json };
}

async function main() {
  console.log(`[smoke-auth] ${base}`);

  const loginEmpty = await post("/api/auth/login", {});
  assert("login empty is 4xx", loginEmpty.status >= 400 && loginEmpty.status < 500);
  assert("login empty is JSON", loginEmpty.contentType.includes("application/json"));
  assert("login empty is not plain Internal Server Error", loginEmpty.text !== "Internal Server Error");

  const verifyEmpty = await post("/api/auth/verify-otp", {});
  assert("verify empty is 4xx", verifyEmpty.status >= 400 && verifyEmpty.status < 500);
  assert("verify empty is JSON", verifyEmpty.contentType.includes("application/json"));

  const verifyUnknown = await post("/api/auth/verify-otp", {
    email: "otp-diagnostic-do-not-use@takatak.ca",
    otp: "000000",
  });
  assert("unknown diagnostic email is 4xx JSON", verifyUnknown.contentType.includes("application/json"));
  assert(
    "unknown diagnostic email stays controlled",
    verifyUnknown.status >= 400 && verifyUnknown.status < 500,
  );

  if (failed > 0) {
    process.exit(1);
  }
}

void main();
