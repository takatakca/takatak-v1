import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";

import { readTrustedJsonBody } from "../src/lib/auth/auth-json";
import { readJsonBody } from "../src/lib/auth/trusted-origin";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

function request(
  body: string | null,
  overrides: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      "Content-Type": "application/json; charset=utf-8",
      ...overrides,
    },
    body,
  });
}

async function check(): Promise<void> {
  assert.deepEqual(
    await readJsonBody(request('{"event":"login"}'), 64),
    { event: "login" },
  );
  const accepted = await readTrustedJsonBody(
    request('{"event":"login"}'),
    64,
  );
  assert.equal(accepted.ok, true);

  const invalidOrigin = await readTrustedJsonBody(
    request("{}", { Origin: "https://attacker.invalid" }),
    64,
  );
  assert.equal(invalidOrigin.ok, false);
  if (!invalidOrigin.ok) {
    assert.equal(invalidOrigin.response.status, 403);
  }

  // An attacker must not be able to turn a forged proxy forwarding header
  // into a trusted CSRF origin for login, registration or password updates.
  const forwardedSpoof = await readTrustedJsonBody(
    request("{}", {
      Origin: "https://attacker.invalid",
      "X-Forwarded-Host": "attacker.invalid",
      "X-Forwarded-Proto": "https",
      Host: "attacker.invalid",
    }),
    64,
  );
  assert.equal(forwardedSpoof.ok, false);
  if (!forwardedSpoof.ok) {
    assert.equal(forwardedSpoof.response.status, 403);
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  const vercelEnv = process.env.VERCEL_ENV;
  try {
    process.env.NEXT_PUBLIC_APP_URL = "not a URL";
    const misconfigured = await readTrustedJsonBody(request("{}"), 64);
    assert.equal(misconfigured.ok, false);
    if (!misconfigured.ok) assert.equal(misconfigured.response.status, 403);

    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_ENV = "production";

    // In production without an explicit app URL, accept only the canonical
    // TAKATAK domain, not a Host or NextRequest-derived origin.
    const fallbackSpoof = await readTrustedJsonBody(
      request("{}", {
        Origin: "https://attacker.invalid",
        "X-Forwarded-Host": "attacker.invalid",
        "X-Forwarded-Proto": "https",
      }),
      64,
    );
    assert.equal(fallbackSpoof.ok, false);
    if (!fallbackSpoof.ok) assert.equal(fallbackSpoof.response.status, 403);
  } finally {
    if (configuredOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = configuredOrigin;
    if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = vercelEnv;
  }

  const missingOrigin = await readTrustedJsonBody(
    request("{}", { Origin: "" }),
    64,
  );
  assert.equal(missingOrigin.ok, false);
  if (!missingOrigin.ok) {
    assert.equal(missingOrigin.response.status, 403);
  }

  const fakeContentType = await readTrustedJsonBody(
    request("{}", { "Content-Type": "application/jsonp" }),
    64,
  );
  assert.equal(fakeContentType.ok, false);
  if (!fakeContentType.ok) {
    assert.equal(fakeContentType.response.status, 415);
  }

  const disguised = await readTrustedJsonBody(
    request('{"data":"' + "x".repeat(200) + '"}', {
      "Content-Length": "2",
    }),
    64,
  );
  assert.equal(disguised.ok, false);
  if (!disguised.ok) {
    assert.equal(disguised.response.status, 413);
  }

  for (const contentLength of ["-1", "not-a-number", "1.5"]) {
    const malformed = await readTrustedJsonBody(
      request("{}", { "Content-Length": contentLength }),
      64,
    );
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.response.status, 400);
  }

  const declaredOver = await readTrustedJsonBody(
    request("{}", { "Content-Length": "10000" }),
    64,
  );
  assert.equal(declaredOver.ok, false);
  if (!declaredOver.ok) assert.equal(declaredOver.response.status, 413);

  const badJson = await readTrustedJsonBody(request("{bad"), 64);
  assert.equal(badJson.ok, false);
  if (!badJson.ok) assert.equal(badJson.response.status, 400);

  const exact = JSON.stringify({ v: "x".repeat(64 - 8) });
  assert.equal(Buffer.byteLength(exact, "utf8"), 64);
  const boundary = await readTrustedJsonBody(request(exact), 64);
  assert.equal(boundary.ok, true);

  const noBody = await readTrustedJsonBody(request(null), 64);
  assert.equal(noBody.ok, false);
  if (!noBody.ok) assert.equal(noBody.response.status, 400);

  const inviteSource = readFileSync(
    resolve(process.cwd(), "src/app/api/auth/complete-invitation/route.ts"),
    "utf8",
  );
  const guard = inviteSource.indexOf("readTrustedJsonBody(request, 8_192)");
  const passwordWrite = inviteSource.indexOf("supabase.auth.updateUser(");
  assert.ok(guard > 0 && passwordWrite > guard,
    "Invitation password update must follow trusted-origin bounded JSON check");
  assert.equal(
    inviteSource.includes("await request.json()"),
    false,
    "Invite route must not use unbounded request.json()",
  );

  console.log("PASS Auth JSON byte ceilings, same-origin and invited-password CSRF gate");
}

check().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
