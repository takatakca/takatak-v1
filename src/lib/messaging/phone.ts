// Phone helpers (pure). North American numbers default to country code 1.

export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

/** Keeps only the last 4 digits for audit display; never store the full number. */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  return `•••${digits.slice(-4)}`;
}
