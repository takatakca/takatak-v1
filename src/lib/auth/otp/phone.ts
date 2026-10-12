/**
 * Normalize explicitly international E.164 numbers or national numbers from
 * a country the user selected. Never guess an international country from a
 * local number: a leading 0 is a national trunk prefix, not an E.164 code.
 */
export type PhoneCountry = "CA" | "NG" | "INTL";

export function normalizePhone(value: string, country: PhoneCountry = "CA"): string | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }

  if (country === "NG") {
    if (/^0[789]\d{9}$/.test(digits)) return `+234${digits.slice(1)}`;
    if (/^[789]\d{9}$/.test(digits)) return `+234${digits}`;
    if (/^234[789]\d{9}$/.test(digits)) return `+${digits}`;
    return null;
  }

  if (country === "CA") {
    if (/^[2-9]\d{9}$/.test(digits)) return `+1${digits}`;
    if (/^1[2-9]\d{9}$/.test(digits)) return `+${digits}`;
  }

  // Other countries require an explicitly supplied +country calling code.
  return null;
}

export function validatePhone(value: string, country: PhoneCountry = "CA"): string | undefined {
  if (!value.trim()) return "Phone number is required.";
  return normalizePhone(value, country)
    ? undefined
    : "Enter a valid number for the selected country, or include +country code.";
}
