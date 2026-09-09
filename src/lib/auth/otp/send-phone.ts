import {
  getTwilioAccountSid,
  getTwilioAuthToken,
  getTwilioVerifyServiceSid,
} from "./env";

function twilioAuthHeader(): string {
  return `Basic ${Buffer.from(
    `${getTwilioAccountSid()}:${getTwilioAuthToken()}`,
  ).toString("base64")}`;
}

export async function sendOtpToPhone(phone: string): Promise<void> {
  const serviceSid = getTwilioVerifyServiceSid();
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        Channel: "sms",
      }),
    },
  );

  if (!response.ok) {
    console.error("[otp-phone] Twilio Verify send failed:", response.status);
    throw new Error("OTP_PHONE_SEND_FAILED");
  }
}

export async function checkOtpFromPhone(
  phone: string,
  code: string,
): Promise<boolean> {
  const serviceSid = getTwilioVerifyServiceSid();
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationChecks`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        Code: code,
      }),
    },
  );

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { status?: string; valid?: boolean };
  return payload.valid === true || payload.status === "approved";
}
