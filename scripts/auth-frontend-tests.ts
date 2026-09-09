import {
  formatAuthErrorMessage,
  isRetryableAuthFailure,
  parseAuthResponse,
} from "../src/lib/auth/parse-auth-response";

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

async function main() {
  console.log("[auth-frontend] OTP response parsing");

  const json = await parseAuthResponse(
    new Response(JSON.stringify({ ok: false, message: "Invalid OTP recheck!", code: "invalid_otp" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }),
  );
  assert("valid JSON uses server message", json.message === "Invalid OTP recheck!");
  assert("invalid OTP is not retryable", isRetryableAuthFailure(json) === false);

  const html = await parseAuthResponse(
    new Response("<html>Internal Server Error</html>", {
      status: 500,
      headers: { "content-type": "text/html" },
    }),
  );
  assert("HTML 500 is non-json", html.kind === "non_json");
  assert("HTML 500 uses stable fallback", html.message.includes("temporarily unavailable"));
  assert("HTML 500 is retryable", isRetryableAuthFailure(html) === true);

  const plain = await parseAuthResponse(
    new Response("Internal Server Error", {
      status: 500,
      headers: { "content-type": "text/plain" },
    }),
  );
  assert("plain text 500 is non-json", plain.kind === "non_json");

  const empty = await parseAuthResponse(new Response("", { status: 500 }));
  assert("empty response is handled", empty.kind === "empty");

  const withId = await parseAuthResponse(
    new Response(
      JSON.stringify({
        ok: false,
        message: "The verification service is temporarily unavailable.",
        errorId: "atk_test_1",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    ),
  );
  assert(
    "errorId is shown to users",
    formatAuthErrorMessage(withId).includes("atk_test_1"),
  );

  const session = await parseAuthResponse(
    new Response(
      JSON.stringify({
        ok: false,
        message: "Unable to start a session. Please try again.",
        code: "session_unavailable",
      }),
      { status: 503, headers: { "content-type": "application/json" } },
    ),
  );
  assert("session failure is retryable", isRetryableAuthFailure(session) === true);

  if (failed > 0) {
    process.exit(1);
  }
}

void main();
