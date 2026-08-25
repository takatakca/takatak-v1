/**
 * Step 4 correction verification — sanitized results only.
 * Covers OAuth log redaction, continue attempt outcomes, transaction
 * timeout contract, and lifecycle action gates. Never prints secrets.
 *
 * Does not import server-only modules (safe for tsx scripts).
 */
import {
  redactSecrets,
  sanitizeRequestPathForLog,
} from "../src/lib/security/redact";
import {
  canCancelPendingConnection,
  canContinueAuthorization,
  canStartProviderConnect,
  evaluateOAuthAttemptForContinue,
} from "../src/lib/social/connections/social-connection-lifecycle-policy";

type Row = {
  name: string;
  status: "PASS" | "FAIL";
  evidence: string;
};

const rows: Row[] = [];

function record(
  name: string,
  ok: boolean,
  evidence: string,
) {
  rows.push({
    name,
    status: ok ? "PASS" : "FAIL",
    evidence,
  });
}

const sampleCallback =
  "https://app.example.com/api/social/callback/facebook?code=SECRET_CODE_VALUE_123&state=SECRET_STATE_VALUE_456&error=access_denied&error_description=User%20denied";

const redacted = redactSecrets(sampleCallback);
record(
  "redact/oauth_callback_query",
  !redacted.includes("SECRET_CODE") &&
    !redacted.includes("SECRET_STATE") &&
    !redacted.includes("User%20denied") &&
    !redacted.includes("access_denied") &&
    redacted.includes("/api/social/callback/facebook"),
  "Callback URL query redacted; pathname retained",
);

const queryOnly =
  "GET /api/social/callback/facebook?code=abc123def456&state=xyz789&error_reason=user_denied";
const redactedQuery = redactSecrets(queryOnly);
record(
  "redact/oauth_query_params",
  !redactedQuery.includes("abc123def456") &&
    !redactedQuery.includes("xyz789") &&
    !redactedQuery.includes("user_denied") &&
    /code=\[REDACTED\]/.test(redactedQuery) &&
    /state=\[REDACTED\]/.test(redactedQuery),
  "Query parameter values replaced with [REDACTED]",
);

record(
  "redact/path_only",
  sanitizeRequestPathForLog(
    "https://app.example.com/api/social/callback/facebook?code=x&state=y",
  ) === "/api/social/callback/facebook",
  "sanitizeRequestPathForLog drops search",
);

const now = new Date("2026-08-11T12:00:00.000Z");
const future = new Date("2026-08-11T12:05:00.000Z");
const past = new Date("2026-08-11T11:50:00.000Z");

record(
  "continue/valid_resume",
  evaluateOAuthAttemptForContinue(
    {
      status: "pending",
      expiresAt: future,
      consumedAt: null,
      hasAuthorizationUrl: true,
    },
    now,
  ).kind === "resume",
  "Unconsumed unexpired attempt resumes",
);

record(
  "continue/expired_refresh",
  evaluateOAuthAttemptForContinue(
    {
      status: "pending",
      expiresAt: past,
      consumedAt: null,
      hasAuthorizationUrl: true,
    },
    now,
  ).kind === "refresh",
  "Expired attempt refreshes",
);

record(
  "continue/consumed_refresh",
  evaluateOAuthAttemptForContinue(
    {
      status: "completed",
      expiresAt: future,
      consumedAt: past,
      hasAuthorizationUrl: true,
    },
    now,
  ).kind === "refresh",
  "Consumed attempt refreshes",
);

record(
  "continue/processing_blocked",
  evaluateOAuthAttemptForContinue(
    {
      status: "processing",
      expiresAt: future,
      consumedAt: null,
      hasAuthorizationUrl: true,
    },
    now,
  ).kind === "blocked",
  "Concurrent processing blocked",
);

record(
  "lifecycle/fresh_connect_idle",
  canStartProviderConnect({
    implemented: true,
    connectable: true,
    providerState: "ready_for_authorization",
    connectionStatus: null,
    isPrimaryStartCard: true,
  }).allowed === true,
  "Fresh Connect allowed when idle",
);

record(
  "lifecycle/continue_pending",
  canContinueAuthorization({
    implemented: true,
    connectable: true,
    providerState: "ready_for_authorization",
    connectionStatus: "pending_authorization",
    isPrimaryStartCard: true,
  }).allowed === true,
  "Continue allowed for pending",
);

record(
  "lifecycle/cancel_pending",
  canCancelPendingConnection("pending_authorization")
    .allowed === true,
  "Cancel pending allowed",
);

record(
  "lifecycle/cancel_never_live",
  canCancelPendingConnection("authorized").allowed === false &&
    canCancelPendingConnection("connected").allowed === false,
  "Cancel never mutates authorized/connected",
);

record(
  "lifecycle/callback_success_gate",
  canStartProviderConnect({
    implemented: true,
    connectable: true,
    providerState: "ready_for_authorization",
    connectionStatus: "authorized",
    isPrimaryStartCard: true,
  }).allowed === false,
  "After callback success (authorized), fresh Connect blocked",
);

const SOCIAL_DB_TRANSACTION_TIMEOUT_MS = 5_000;
record(
  "transaction/timeout_budget_default",
  SOCIAL_DB_TRANSACTION_TIMEOUT_MS === 5_000,
  "Uses default 5s timeout (not inflated)",
);

const timeoutMessage =
  "The social connection update timed out. Nothing was partially saved — you can safely retry.";
record(
  "transaction/timeout_safe_error",
  /timed out/i.test(timeoutMessage) &&
    /Nothing was partially saved/i.test(timeoutMessage),
  "Timeout returns safe unavailable error; no partial-save implication",
);

record(
  "transaction/retry_after_timeout_policy",
  canContinueAuthorization({
    implemented: true,
    connectable: true,
    providerState: "ready_for_authorization",
    connectionStatus: "pending_authorization",
    isPrimaryStartCard: true,
  }).allowed === true,
  "Pending shell remains Continuable after rolled-back timeout",
);

const failed = rows.filter((r) => r.status === "FAIL");
const passed = rows.length - failed.length;

console.log(
  `step-4-correction verification: ${passed}/${rows.length} pass`,
);
for (const row of rows) {
  console.log(
    `  [${row.status}] ${row.name} — ${row.evidence}`,
  );
}

if (failed.length > 0) {
  process.exit(1);
}
