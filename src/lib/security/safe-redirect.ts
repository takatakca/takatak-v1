// Phase 14 — Same-origin redirect target validation.
// Only relative paths that start with a single "/" are allowed. Rejects
// absolute URLs, protocol-relative ("//evil.com"), backslash variants
// ("/\\evil.com" — browsers normalize \\ to /), and control characters.

const FALLBACK = "/dashboard";

export function sanitizeNextPath(raw: string | null | undefined, fallback: string = FALLBACK): string {
  if (!raw) return fallback;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (!decoded.startsWith("/")) return fallback;         // must be relative
  if (decoded.startsWith("//")) return fallback;          // protocol-relative
  if (decoded.includes("\\")) return fallback;            // backslash variants
  if (/[\u0000-\u001f]/.test(decoded)) return fallback;  // control chars
  if (decoded.includes("://")) return fallback;           // embedded scheme
  return decoded;
}
