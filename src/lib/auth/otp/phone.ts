/** Normalize explicit E.164 numbers and complete Canada/US phone numbers.
 * Do not manufacture a country code for ambiguous or incomplete input.
 */
export function normalizePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;
  const digits = compact.startsWith("+") ? compact.slice(1) : compact;

  let normalized: string;
  if (compact.startsWith("+")) {
    normalized = "+" + digits;
  } else if (digits.length === 10) {
    normalized = "+1" + digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    normalized = "+" + digits;
  } else {
    return null;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return null;
  // NANP area and exchange codes cannot start with 0 or 1.
  if (normalized.startsWith("+1") && !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(normalized)) return null;
  return normalized;
}

export function validatePhone(value: string): string | undefined {
  if (!value.trim()) return "Phone number is required.";
  if (!normalizePhone(value)) return "Enter a valid phone number.";
  return undefined;
}
