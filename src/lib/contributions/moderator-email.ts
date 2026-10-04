import "server-only";

import {
  getGmailPassword,
  getGmailUser,
  getOtpSenderEmail,
  getSendgridApiKey,
  getSmtpHost,
  getSmtpPort,
  isGmailSmtpConfigured,
  isSendgridConfigured,
} from "@/lib/auth/otp/env";
import { sendMailViaSmtp } from "@/lib/auth/otp/smtp";

export type ModeratorEmailResult = "sent" | "not_configured" | "failed";

async function sendGrid(options: {
  to: string;
  subject: string;
  text: string;
}) {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSendgridApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: options.to }] }],
      from: {
        email: getOtpSenderEmail(),
        name: "TAKATAK Moderation",
      },
      subject: options.subject,
      content: [{ type: "text/plain", value: options.text }],
    }),
  });

  if (!response.ok) {
    throw new Error(`SendGrid rejected moderation email: ${response.status}`);
  }
}

export async function sendModeratorEmail(options: {
  to: string;
  subject: string;
  text: string;
}): Promise<ModeratorEmailResult> {
  try {
    if (isSendgridConfigured()) {
      await sendGrid(options);
      return "sent";
    }

    if (isGmailSmtpConfigured()) {
      const user = getGmailUser();
      await sendMailViaSmtp({
        host: getSmtpHost(),
        port: getSmtpPort(),
        user,
        password: getGmailPassword(),
        from: getOtpSenderEmail() || user,
        to: options.to,
        subject: options.subject,
        text: options.text,
      });
      return "sent";
    }

    return "not_configured";
  } catch (error) {
    console.error(
      "[content-moderation-email] delivery failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return "failed";
  }
}
