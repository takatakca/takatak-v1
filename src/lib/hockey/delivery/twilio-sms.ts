import "server-only";

import {
  getTwilioAccountSid,
  getTwilioAuthToken,
} from "@/lib/auth/otp/env";
import { ServiceError } from "@/lib/services/service-error";

const TIMEOUT_MS = 12_000;

function messagingServiceSid(): string {
  return process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() ?? "";
}

function fromNumber(): string {
  return process.env.TWILIO_SMS_FROM?.trim() ?? "";
}

export function isHockeySmsConfigured(): boolean {
  return Boolean(
    process.env.HOCKEY_SMS_ENABLED === "true" &&
      getTwilioAccountSid() &&
      getTwilioAuthToken() &&
      (messagingServiceSid() || fromNumber()),
  );
}

export async function sendHockeySms(input: {
  to: string;
  body: string;
}): Promise<{ sid: string | null }> {
  if (!isHockeySmsConfigured()) {
    throw new ServiceError("unavailable", "AHMV SMS delivery is not configured.");
  }

  const accountSid = getTwilioAccountSid();
  const authToken = getTwilioAuthToken();
  const form = new URLSearchParams({
    To: input.to,
    Body: input.body,
  });

  if (messagingServiceSid()) {
    form.set("MessagingServiceSid", messagingServiceSid());
  } else {
    form.set("From", fromNumber());
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new ServiceError("unavailable", "Twilio could not send the AHMV reminder.");
    }

    const payload = (await response.json()) as { sid?: unknown };
    return {
      sid: typeof payload.sid === "string" ? payload.sid : null,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("unavailable", "AHMV SMS delivery failed temporarily.");
  } finally {
    clearTimeout(timeout);
  }
}
