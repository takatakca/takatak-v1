import {
  normalizeEmail,
  validateEmail,
  validatePassword,
} from "@/lib/auth/registration-validation";
import {
  invalidRequest,
  isRecord,
  type ValidationResult,
} from "@/lib/validation/common";

export interface AccountAccessInput {
  email: string;
  newPassword: string | null;
}

export type AccountAccessFieldErrors = Partial<
  Record<"email" | "newPassword", string>
>;

export function validateAccountAccessInput(
  value: unknown,
): ValidationResult<AccountAccessInput> {
  if (!isRecord(value)) {
    return invalidRequest({}, "The access request is invalid.");
  }

  const fieldErrors: Record<string, string> = {};

  if (typeof value.email !== "string") {
    fieldErrors.email = "Email is required.";
  }

  const email = normalizeEmail(
    typeof value.email === "string" ? value.email : "",
  );
  const emailError = validateEmail(email);
  if (emailError) {
    fieldErrors.email = emailError;
  }

  let newPassword: string | null = null;
  if (
    value.newPassword !== undefined &&
    value.newPassword !== null &&
    value.newPassword !== ""
  ) {
    if (typeof value.newPassword !== "string") {
      fieldErrors.newPassword = "Enter a valid password.";
    } else {
      const passwordError = validatePassword(value.newPassword);
      if (passwordError) {
        fieldErrors.newPassword = passwordError;
      } else {
        newPassword = value.newPassword;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return invalidRequest(fieldErrors, "Correct the highlighted access fields.");
  }

  return {
    success: true,
    data: { email, newPassword },
  };
}
