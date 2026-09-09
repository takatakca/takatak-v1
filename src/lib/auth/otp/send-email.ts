import {
  getGmailPassword,
  getGmailUser,
  getOtpSenderEmail,
  getSendgridApiKey,
  getSmtpHost,
  getSmtpPort,
  isGmailSmtpConfigured,
  isSendgridConfigured,
} from "./env";
import { sendMailViaSmtp } from "./smtp";

function otpMessage(otp: string): string {
  return `Your OTP is: ${otp}. It will expire in 5 minutes.

Don’t share this code with anyone.
Our employees will never ask for this code.`;
}

async function sendViaSendgrid(email: string, otp: string): Promise<void> {
  const apiKey = getSendgridApiKey();
  const sender = getOtpSenderEmail();

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: {
        email: sender,
        name: "Takatak Team",
      },
      subject: "OTP from Takatak Platform",
      content: [
        {
          type: "text/plain",
          value: otpMessage(otp),
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("[otp-email] SendGrid rejected the message:", response.status);
    throw new Error("OTP_EMAIL_SEND_FAILED");
  }
}

async function sendViaGmailSmtp(email: string, otp: string): Promise<void> {
  const user = getGmailUser();
  const password = getGmailPassword();
  const sender = getOtpSenderEmail() || user;

  try {
    await sendMailViaSmtp({
      host: getSmtpHost(),
      port: getSmtpPort(),
      user,
      password,
      from: sender,
      to: email,
      subject: "OTP from Takatak Platform",
      text: otpMessage(otp),
    });
  } catch (error) {
    console.error(
      "[otp-email] Gmail SMTP failed:",
      error instanceof Error ? error.message : "unknown",
    );
    throw new Error("OTP_EMAIL_SEND_FAILED");
  }
}

export async function sendOtpToEmail(
  email: string,
  otp: string,
): Promise<void> {
  if (isSendgridConfigured()) {
    await sendViaSendgrid(email, otp);
    return;
  }

  if (isGmailSmtpConfigured()) {
    await sendViaGmailSmtp(email, otp);
    return;
  }

  throw new Error("OTP_EMAIL_NOT_CONFIGURED");
}
