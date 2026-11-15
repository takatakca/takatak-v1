/**
 * The Business Information API exposes phoneNumbers.primaryPhone in its
 * location readMask. Keep this parser pure so it can be tested without OAuth.
 */
export function getGoogleBusinessPrimaryPhone(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const phone = (value as { primaryPhone?: unknown }).primaryPhone;
  if (typeof phone !== "string") return null;
  const trimmed = phone.trim();
  return trimmed && trimmed.length <= 80 ? trimmed : null;
}
