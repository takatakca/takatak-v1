import {
  normalizeEmail,
  validateEmail,
} from "@/lib/auth/registration-validation";
import {
  invalidRequest,
  isRecord,
  type ValidationResult,
} from "@/lib/validation/common";

export interface AccountAccessInput {
  email: string | null;
}

export type AccountAccessFieldErrors = Partial<
  Record<"email", string>
>;

export function validateAccountAccessInput(
  value: unknown,
): ValidationResult<AccountAccessInput> {
  if (!isRecord(value)) {
    return invalidRequest({}, "The access request is invalid.");
  }

  const fieldErrors: Record<string, string> = {};

  const rawEmail = typeof value.email === "string" ? value.email.trim() : "";
  if (value.email !== undefined && value.email !== null && typeof value.email !== "string") {
    fieldErrors.email = "Enter a valid email address.";
  }

  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  if (email) {
    const emailError = validateEmail(email);
    if (emailError) {
      fieldErrors.email = emailError;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return invalidRequest(fieldErrors, "Correct the highlighted access fields.");
  }

  return {
    success: true,
    data: { email },
  };
}
