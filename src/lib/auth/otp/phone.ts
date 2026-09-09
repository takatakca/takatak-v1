/** E.164 for Canada/US by default. Accepts +country numbers as-is. */
export function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 8 || digits.length > 15) {
    return null;
  }

  if (hasPlus) {
    return `+${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return `+${digits}`;
}

export function validatePhone(value: string): string | undefined {
  if (!value.trim()) {
    return "Phone number is required.";
  }

  if (!normalizePhone(value)) {
    return "Enter a valid phone number.";
  }

  return undefined;
}
