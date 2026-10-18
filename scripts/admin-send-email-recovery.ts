/**
 * Operator-only recovery for an existing phone-verified TAKATAK identity.
 *
 * Usage (on a trusted deployment machine with existing server env loaded):
 *   npx tsx scripts/admin-send-email-recovery.ts AUTH_USER_UUID real-inbox@example.com
 *
 * No public HTTP endpoint. Never run with a guessed email or an identity other
 * than the one independently verified by the operator.
 */
import { createClient } from "@supabase/supabase-js";
import { sendMailViaSmtp } from "../src/lib/auth/otp/smtp";
import {
  getGmailUser, getGmailPassword, getOtpSenderEmail, getSendgridApiKey,
  getSmtpHost, getSmtpPort, isGmailSmtpConfigured, isSendgridConfigured,
} from "../src/lib/auth/otp/env";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const userId = process.argv[2]?.trim();
const email = process.argv[3]?.trim().toLowerCase();
const confirmationOrigin = "https://takatak.ca";

async function sendEmail(address: string, verificationUrl: string) {
  const subject = "Confirm your TAKATAK recovery email";
  const content = `You requested TAKATAK email recovery. Open this one-time link to verify your inbox and sign in:\n\n${verificationUrl}\n\nIf you did not request this, ignore the message. Never forward the link.`;
  if (isSendgridConfigured()) {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${getSendgridApiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: address }] }],
        from: { email: getOtpSenderEmail(), name: "TAKATAK" },
        subject,
        content: [{ type: "text/plain", value: content }],
      }),
    });
    if (!response.ok) throw new Error(`SendGrid rejected email: HTTP ${response.status}`);
    return;
  }
  if (isGmailSmtpConfigured()) {
    await sendMailViaSmtp({
      host: getSmtpHost(), port: getSmtpPort(), user: getGmailUser(),
      password: getGmailPassword(), from: getOtpSenderEmail() || getGmailUser(),
      to: address, subject, text: content,
    });
    return;
  }
  throw new Error("Email provider not configured; requires SendGrid or Gmail SMTP.");
}

async function main() {
  if (!userId || !UUID.test(userId) || !email || !EMAIL.test(email)) {
    throw new Error("Usage: npx tsx scripts/admin-send-email-recovery.ts AUTH_USER_UUID real-inbox@example.com");
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase admin configuration missing.");
  if (!isSendgridConfigured() && !isGmailSmtpConfigured()) {
    throw new Error("Email provider not configured. No Auth changes made.");
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const lookup = await admin.auth.admin.getUserById(userId);
  if (lookup.error || !lookup.data.user) throw new Error("Existing Auth user not found.");
  const existing = lookup.data.user;
  if (!existing.phone || !existing.phone_confirmed_at) {
    throw new Error("Refusing email recovery: user's phone is not verified.");
  }
  if (existing.email && existing.email.toLowerCase() !== email) {
    throw new Error("Refusing to overwrite an existing Auth email. Use signed-in Account settings.");
  }
  // Prevent linking an email already assigned to a separate Auth user: the
  // Auth provider's uniqueness constraint remains authoritative.
  if (!existing.email) {
    const update = await admin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: false,
    });
    if (update.error || update.data.user?.id !== userId) {
      throw new Error("Could not attach unverified email to existing Auth user.");
    }
  }
  const generated = await admin.auth.admin.generateLink({
    type: "magiclink", email,
    options: { redirectTo: `${confirmationOrigin}/auth/callback?next=/dashboard/account` },
  });
  const tokenHash = generated.data?.properties?.hashed_token;
  if (generated.error || !tokenHash || generated.data.user?.id !== userId) {
    throw new Error("Could not create same-user email verification link.");
  }
  const verify = new URL("/auth/callback", confirmationOrigin);
  verify.searchParams.set("token_hash", tokenHash);
  verify.searchParams.set("type", "magiclink");
  verify.searchParams.set("next", "/dashboard/account");
  await sendEmail(email, verify.toString());
  console.log("Recovery email sent to the supplied inbox for the existing Auth user.");
  console.log("Open the link from that inbox. Callback will sync the verified email into TAKATAK.");
  // Never print the sensitive verification URL/token.
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Recovery failed");
  process.exitCode = 1;
});
