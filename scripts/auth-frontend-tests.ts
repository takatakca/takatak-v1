import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatAuthErrorMessage,
  isRetryableAuthFailure,
  parseAuthResponse,
} from "../src/lib/auth/parse-auth-response";
import { phoneAuthMessage } from "../src/lib/auth/phone-auth-message";

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
  console.log("[auth-frontend] phone OTP error messages");
  assert("unknown number → create identity", phoneAuthMessage("Signups not allowed for otp", "otp_disabled").includes("Create your identity"));
  assert("unknown number (message only)", phoneAuthMessage("Signups not allowed for otp").includes("Create your identity"));
  assert("phone provider off", phoneAuthMessage("Unsupported phone provider", "phone_provider_disabled").includes("not enabled"));
  assert("Twilio failure", phoneAuthMessage("Error sending confirmation OTP to provider: Invalid From Number", "sms_send_failed").includes("SMS provider"));
  assert("rate limit", phoneAuthMessage("For security purposes, you can only request this after 42 seconds.", "over_sms_send_rate_limit").includes("Too many"));
  assert("unknown error stays generic", phoneAuthMessage("boom") === "Unable to send the TAKATAK SMS code. Please try again.");

  console.log("[auth-frontend] OTP response parsing");

  const loginRoute = readFileSync(
    resolve(process.cwd(), "src/app/api/auth/login/route.ts"),
    "utf8",
  );
  const verifyRoute = readFileSync(
    resolve(process.cwd(), "src/app/api/auth/verify-otp/route.ts"),
    "utf8",
  );
  const resendRoute = readFileSync(
    resolve(process.cwd(), "src/app/api/auth/resend-code/route.ts"),
    "utf8",
  );

  assert(
    "legacy login route cannot send server-side phone OTP",
    !loginRoute.includes("sendPhoneOtp(") &&
      loginRoute.includes("phone_auth_migrated"),
  );
  assert(
    "legacy verify route cannot convert Twilio phone proof into an email-confirmed session",
    !verifyRoute.includes("verifyPhoneOtp(") &&
      verifyRoute.includes("phone_auth_migrated"),
  );
  assert(
    "legacy resend route cannot use the old phone OTP sender",
    !resendRoute.includes("sendPhoneOtp(") &&
      resendRoute.includes("phone_auth_migrated"),
  );

  const loginForm = readFileSync(
    resolve(process.cwd(), "src/components/auth/master-phone-login-form.tsx"),
    "utf8",
  );
  const registrationForm = readFileSync(
    resolve(process.cwd(), "src/components/auth/master-phone-registration-form.tsx"),
    "utf8",
  );
  assert(
    "login opens on the mobile number",
    loginForm.includes('useState<Mode>("phone")'),
  );
  assert(
    "registration does not submit an unverified recovery email",
    !registrationForm.includes("validateEmail") &&
      registrationForm.includes("confirm the message sent to that inbox"),
  );

  const accessRoute = readFileSync(
    resolve(process.cwd(), "src/app/api/account/access/route.ts"),
    "utf8",
  );
  const profileSync = readFileSync(
    resolve(process.cwd(), "src/lib/auth/profile-sync.ts"),
    "utf8",
  );
  assert(
    "account access cannot mark a new email confirmed",
    !accessRoute.includes("email_confirm") &&
      !accessRoute.includes("updateUserById") &&
      accessRoute.includes("verificationPending") &&
      accessRoute.includes("account_email_verification_requested"),
  );
  assert(
    "profile sync ignores client-supplied email metadata",
    !profileSync.includes("user_metadata?.email") &&
      !profileSync.includes("user_metadata.email") &&
      profileSync.includes("email_confirmed_at"),
  );

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
