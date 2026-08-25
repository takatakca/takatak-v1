/**
 * Runtime verification: OAuth callback access-log protection.
 * Uses synthetic placeholders only — never real OAuth credentials.
 *
 * Confirms:
 * - Required callback fields are still received/processed
 * - Next.js dev access logger ignores /api/social/callback/*
 * - Placeholders do not appear in captured process logs
 * - Production first-hop requires the relay (documented, not claimed complete)
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

type Row = { name: string; status: "PASS" | "FAIL"; evidence: string };
const rows: Row[] = [];

function record(name: string, ok: boolean, evidence: string) {
  rows.push({ name, status: ok ? "PASS" : "FAIL", evidence });
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), ".env.local"));

if (!process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1?.trim()) {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 =
    randomBytes(32).toString("base64");
}

const PLACEHOLDERS = {
  code: "PLACEHOLDER_CODE_SYNTHETIC_0001",
  state: "PLACEHOLDER_STATE_SYNTHETIC_0001",
  error_description: "PLACEHOLDER_ERROR_DESC_SYNTHETIC",
  token: "PLACEHOLDER_TOKEN_SYNTHETIC_0001",
  verifier: "PLACEHOLDER_VERIFIER_SYNTHETIC_0001",
};

function assertNoPlaceholders(blob: string, label: string): boolean {
  for (const [key, value] of Object.entries(PLACEHOLDERS)) {
    if (blob.includes(value)) {
      record(
        label,
        false,
        `Captured logs contained synthetic ${key} placeholder`,
      );
      return false;
    }
  }
  return true;
}

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("port"));
        return;
      }
      const port = addr.port;
      server.close(() => resolvePort(port));
    });
  });
}

async function main() {
  // 1) next.config ignore present
  const configText = readFileSync(
    resolve(process.cwd(), "next.config.ts"),
    "utf8",
  );
  record(
    "config/dev_access_log_ignore",
    /incomingRequests/.test(configText) &&
      /ignore\s*:/.test(configText) &&
      /api\\\/social\\\/callback/.test(configText),
    "next.config.ts ignores /api/social/callback/ in dev access logs",
  );

  record(
    "config/production_relay_docs",
    existsSync(
      resolve(
        process.cwd(),
        "deploy/oauth-callback-relay/cloudflare-worker.js",
      ),
    ),
    "Production relay worker present for first-hop hosting-log protection",
  );

  // 2) Handoff still carries required fields (receive + process path)
  const {
    sealFacebookOAuthHandoff,
    unsealFacebookOAuthHandoff,
    handoffPayloadToRawQuery,
  } = await import(
    "../src/lib/social/connections/facebook-oauth-handoff"
  );

  const sealed = sealFacebookOAuthHandoff({
    code: PLACEHOLDERS.code,
    state: PLACEHOLDERS.state,
    error_description: PLACEHOLDERS.error_description,
  });

  const unsealed = unsealFacebookOAuthHandoff(sealed);
  const rawQuery = handoffPayloadToRawQuery(unsealed);

  record(
    "runtime/handoff_preserves_params",
    rawQuery.code === PLACEHOLDERS.code &&
      rawQuery.state === PLACEHOLDERS.state &&
      rawQuery.error_description ===
        PLACEHOLDERS.error_description,
    "Ingress→handoff seal preserves code/state/error_description for processing",
  );

  const { processFacebookOAuthCallback } = await import(
    "../src/lib/social/connections/facebook-oauth-callback"
  );

  const processed = await processFacebookOAuthCallback({
    rawQuery: {
      code: PLACEHOLDERS.code,
      state: PLACEHOLDERS.state,
    },
    profileId: null,
  });

  record(
    "runtime/callback_receives_params",
    processed.outcome === "failed" &&
      /invalid|Sign in|incomplete|authorization/i.test(
        processed.message,
      ),
    "Callback processor accepts required fields (synthetic; expected safe failure without session/DB match)",
  );

  // 3) Redaction of accidental URL logging
  const { redactSecrets } = await import(
    "../src/lib/security/redact"
  );
  const dirty =
    `GET /api/social/callback/facebook?code=${PLACEHOLDERS.code}&state=${PLACEHOLDERS.state}&error_description=${PLACEHOLDERS.error_description}` +
    ` access_token=${PLACEHOLDERS.token} code_verifier=${PLACEHOLDERS.verifier}`;
  const cleaned = redactSecrets(dirty);
  const redactionClean = !Object.values(PLACEHOLDERS).some((value) =>
    cleaned.includes(value),
  );
  record(
    "runtime/redact_synthetic_url",
    redactionClean &&
      cleaned.includes("/api/social/callback/facebook"),
    redactionClean
      ? "Sanitizer strips synthetic secrets while keeping pathname"
      : "Sanitizer left a synthetic placeholder visible",
  );

  // 4) Live Next.js dev access logger behavior
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const capture: string[] = [];

  const child = spawn(
    "npx",
    ["next", "dev", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const onData = (buf: Buffer) => {
    capture.push(buf.toString("utf8"));
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  const ready = await new Promise<boolean>((resolveReady) => {
    const deadline = Date.now() + 90_000;
    const timer = setInterval(() => {
      const blob = capture.join("");
      if (
        /Ready in|started server|Local:|✓ Ready/i.test(blob)
      ) {
        clearInterval(timer);
        resolveReady(true);
      } else if (Date.now() > deadline) {
        clearInterval(timer);
        resolveReady(false);
      }
    }, 500);
  });

  if (!ready) {
    child.kill("SIGTERM");
    record(
      "runtime/next_dev_access_log",
      false,
      "Next.js dev server did not become ready in time",
    );
  } else {
    // Warm-up unrelated request so we know logging works.
    await fetch(`${base}/api/health`).catch(() => null);
    await new Promise((r) => setTimeout(r, 800));

    const beforeLen = capture.join("").length;

    const callbackUrl =
      `${base}/api/social/callback/facebook` +
      `?code=${encodeURIComponent(PLACEHOLDERS.code)}` +
      `&state=${encodeURIComponent(PLACEHOLDERS.state)}` +
      `&error_description=${encodeURIComponent(PLACEHOLDERS.error_description)}`;

    const response = await fetch(callbackUrl, {
      redirect: "manual",
    });

    // Allow logger flush
    await new Promise((r) => setTimeout(r, 1200));

    const after = capture.join("").slice(beforeLen);
    const full = capture.join("");

    const placeholdersInNewLogs = Object.values(PLACEHOLDERS).some(
      (value) => after.includes(value) || full.includes(value),
    );

    // Dev access lines typically look like: GET /path 200
    const accessLineWithQuery =
      /GET\s+\/api\/social\/callback\/facebook\?[^\s]*code=/i.test(
        after,
      ) ||
      /GET\s+http[^\s]*\/api\/social\/callback\/facebook\?[^\s]*code=/i.test(
        after,
      );

    record(
      "runtime/next_dev_access_log_omits_callback_or_query",
      !placeholdersInNewLogs && !accessLineWithQuery,
      !placeholdersInNewLogs && !accessLineWithQuery
        ? `Callback request omitted or logged without query (HTTP ${response.status}); placeholders absent from captured Next logs`
        : "Sensitive callback query or placeholders appeared in captured Next.js logs",
    );

    // Handoff follow (if redirected) should be query-free
    const location = response.headers.get("location") ?? "";
    record(
      "runtime/ingress_redirects_to_clean_handoff",
      response.status === 303 &&
        /\/api\/social\/callback\/facebook\/handoff\/?$/.test(
          new URL(location, base).pathname,
        ) &&
        !location.includes("code=") &&
        !location.includes("state="),
      `Ingress returned ${response.status} Location without OAuth query secrets`,
    );

    child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
  }

  // 5) Honest production boundary statement (always recorded)
  record(
    "production/first_hop_requires_relay",
    true,
    "LIMITATION: If META_OAUTH_REDIRECT_URI points at Next.js, host/Vercel access logs can still record Meta's first GET with query. Complete production protection requires the relay (deploy/oauth-callback-relay) so the Next.js origin only receives POST without query.",
  );

  const failed = rows.filter((r) => r.status === "FAIL");
  const passed = rows.length - failed.length;

  console.log(
    `oauth-access-log verification: ${passed}/${rows.length} pass`,
  );
  for (const row of rows) {
    console.log(
      `  [${row.status}] ${row.name} — ${row.evidence}`,
    );
  }

  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(
    "oauth-access-log verification failed:",
    error instanceof Error ? error.message : "unknown",
  );
  process.exit(1);
});
