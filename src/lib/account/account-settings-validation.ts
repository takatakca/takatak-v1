import {
  normalizeEmail,
  normalizePersonName,
  validateEmail,
  validateFirstName,
  validateLastName,
} from "@/lib/auth/registration-validation";
import {
  invalidRequest,
  isRecord,
  isValidTimeZone,
  type ValidationResult,
} from "@/lib/validation/common";

export const ACCOUNT_LANGUAGES = ["en"] as const;
export type AccountLanguage = (typeof ACCOUNT_LANGUAGES)[number];

export const WEEK_STARTS = ["sunday", "monday"] as const;
export type WeekStartsOn = (typeof WEEK_STARTS)[number];

export interface AccountSettingsInput {
  firstName: string;
  lastName: string;
  language: AccountLanguage;
  timezone: string;
  weekStartsOn: WeekStartsOn;
  monthlySummaryEnabled: boolean;
  monthlySummaryEmail: string | null;
}

export type AccountSettingsFieldErrors = Partial<
  Record<keyof AccountSettingsInput, string>
>;

export function validateAccountSettingsInput(
  value: unknown,
): ValidationResult<AccountSettingsInput & { displayName: string }> {
  if (!isRecord(value)) {
    return invalidRequest({}, "The account settings request is invalid.");
  }

  const fieldErrors: Record<string, string> = {};

  if (typeof value.firstName !== "string") {
    fieldErrors.firstName = "First name is required.";
  }
  if (typeof value.lastName !== "string") {
    fieldErrors.lastName = "Last name must be text.";
  }

  const firstName = normalizePersonName(
    typeof value.firstName === "string" ? value.firstName : "",
  );
  const lastName = normalizePersonName(
    typeof value.lastName === "string" ? value.lastName : "",
  );

  const firstNameError = validateFirstName(firstName);
  if (firstNameError) {
    fieldErrors.firstName = firstNameError;
  }

  if (lastName) {
    const lastNameError = validateLastName(lastName);
    if (lastNameError) {
      fieldErrors.lastName = lastNameError;
    }
  }

  const language =
    typeof value.language === "string" ? value.language.trim().toLowerCase() : "";
  if (!ACCOUNT_LANGUAGES.includes(language as AccountLanguage)) {
    fieldErrors.language = "Select a supported language.";
  }

  const timezone =
    typeof value.timezone === "string" ? value.timezone.trim() : "";
  if (!timezone) {
    fieldErrors.timezone = "Timezone is required.";
  } else if (!isValidTimeZone(timezone)) {
    fieldErrors.timezone =
      "Timezone must be a valid IANA timezone, such as America/Toronto.";
  }

  const weekStartsOn =
    typeof value.weekStartsOn === "string"
      ? value.weekStartsOn.trim().toLowerCase()
      : "";
  if (!WEEK_STARTS.includes(weekStartsOn as WeekStartsOn)) {
    fieldErrors.weekStartsOn = "Select Sunday or Monday.";
  }

  if (typeof value.monthlySummaryEnabled !== "boolean") {
    fieldErrors.monthlySummaryEnabled = "Choose whether to receive a monthly summary.";
  }

  let monthlySummaryEmail: string | null = null;
  if (
    value.monthlySummaryEmail !== undefined &&
    value.monthlySummaryEmail !== null &&
    value.monthlySummaryEmail !== ""
  ) {
    if (typeof value.monthlySummaryEmail !== "string") {
      fieldErrors.monthlySummaryEmail = "Enter a valid email address.";
    } else {
      monthlySummaryEmail = normalizeEmail(value.monthlySummaryEmail);
      const emailError = validateEmail(monthlySummaryEmail);
      if (emailError) {
        fieldErrors.monthlySummaryEmail = emailError;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return invalidRequest(fieldErrors, "Correct the highlighted account fields.");
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    success: true,
    data: {
      firstName,
      lastName,
      language: language as AccountLanguage,
      timezone,
      weekStartsOn: weekStartsOn as WeekStartsOn,
      monthlySummaryEnabled: value.monthlySummaryEnabled === true,
      monthlySummaryEmail,
      displayName,
    },
  };
}
