import { MasterApiInputError } from "./errors";

const FORBIDDEN_KEYS = new Set([
  "password",
  "passwordhash",
  "otp",
  "otpcode",
  "session",
  "sessiontoken",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "setcookie",
  "servicerolekey",
  "supabaseservicerolekey",
  "stripesecretkey",
  "clientsecret",
  "cardnumber",
  "cardtoken",
  "cvc",
  "cvv",
]);

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsForbiddenField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenField);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) =>
      FORBIDDEN_KEYS.has(normalizedKey(key)) ||
      containsForbiddenField(nested),
  );
}

export function assertMasterPayloadSafe(value: unknown): void {
  if (containsForbiddenField(value)) {
    throw new MasterApiInputError(
      "Payload contains a forbidden secret or credential field.",
    );
  }
}
