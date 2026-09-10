export function getSendgridApiKey(): string {
  return process.env.SENDGRID_API_KEY?.trim() || "";
}

export function getOtpSenderEmail(): string {
  return (
    process.env.SENDER_EMAIL?.trim() ||
    process.env.EMAIL_USER?.trim() ||
    ""
  );
}

export function getGmailUser(): string {
  return process.env.EMAIL_USER?.trim() || "";
}

export function getGmailPassword(): string {
  return (
    process.env.EMAIL_PASSWORD?.trim() ||
    process.env.GMAIL_APP_PASSWORD?.trim() ||
    ""
  );
}

export function getSmtpHost(): string {
  return process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
}

export function getSmtpPort(): number {
  const parsed = Number(process.env.SMTP_PORT?.trim() || "587");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 587;
}

export function isSendgridConfigured(): boolean {
  return Boolean(getSendgridApiKey() && getOtpSenderEmail());
}

export function isGmailSmtpConfigured(): boolean {
  return Boolean(getGmailUser() && getGmailPassword());
}

export function isMemoryOtpAdapter(): boolean {
  return process.env.OTP_EMAIL_ADAPTER?.trim() === "memory";
}

export function isEmailOtpConfigured(): boolean {
  return (
    isMemoryOtpAdapter() || isSendgridConfigured() || isGmailSmtpConfigured()
  );
}

export function getTwilioAccountSid(): string {
  return process.env.TWILIO_ACCOUNT_SID?.trim() || "";
}

export function getTwilioAuthToken(): string {
  return process.env.TWILIO_AUTH_TOKEN?.trim() || "";
}

export function getTwilioVerifyServiceSid(): string {
  return process.env.TWILIO_VERIFY_SERVICE_SID?.trim() || "";
}

export function isPhoneOtpConfigured(): boolean {
  return Boolean(
    getTwilioAccountSid() &&
      getTwilioAuthToken() &&
      getTwilioVerifyServiceSid(),
  );
}
