/**
 * Central redaction for logs, errors, monitoring, and diagnostics.
 * Includes OAuth callback query/URL shapes so authorization codes,
 * state, errors, and error descriptions never appear in logs.
 */

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "postgres_url", re: /postgres(?:ql)?:\/\/[^\s"']+/gi },
  { name: "mysql_url", re: /mysql:\/\/[^\s"']+/gi },
  { name: "bearer_token", re: /bearer\s+[a-z0-9._~+/=-]{12,}/gi },
  {
    name: "jwt",
    re: /eyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}/g,
  },
  { name: "openai_key", re: /sk-[a-zA-Z0-9_-]{16,}/g },
  {
    name: "private_key_block",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    name: "generic_secret_assignment",
    re: /((?:api[_-]?key|secret|token|password|passwd|pwd)\s*[=:]\s*)["']?[^\s"']{8,}["']?/gi,
  },
  { name: "cookie_header", re: /(cookie\s*:\s*)[^\n]+/gi },
  { name: "authorization_header", re: /(authorization\s*:\s*)[^\n]+/gi },
  // OAuth / OIDC query parameters (callback + token endpoints).
  {
    name: "oauth_query_params",
    re: /([?&](?:code|state|error|error_reason|error_description|error_code|access_token|refresh_token|id_token|client_secret|code_verifier|code_challenge|assertion)=)[^&\s"'#<>]*/gi,
  },
  // Bare assignment forms sometimes appear in diagnostic strings.
  {
    name: "oauth_assignment_forms",
    re: /\b((?:access_token|refresh_token|id_token|client_secret|code_verifier|authorization_code|oauth_state)\s*[=:]\s*)["']?[^\s"']{8,}["']?/gi,
  },
  // Full social OAuth callback URLs (strip query entirely).
  {
    name: "social_oauth_callback_url",
    re: /https?:\/\/[^\s"'<>]*\/api\/social\/callback\/[a-z0-9_-]+[^\s"'<>]*/gi,
  },
];

/** Redact credible secret and OAuth shapes from arbitrary text. */
export function redactSecrets(input: string): string {
  let out = input;

  for (const { name, re } of PATTERNS) {
    out = out.replace(re, (match, prefix?: string) => {
      if (name === "social_oauth_callback_url") {
        try {
          const url = new URL(match);
          return `${url.origin}${url.pathname}?[REDACTED]`;
        } catch {
          return "[REDACTED_OAUTH_CALLBACK_URL]";
        }
      }

      return typeof prefix === "string"
        ? `${prefix}[REDACTED]`
        : "[REDACTED]";
    });
  }

  return out;
}

/**
 * Return pathname only for logging. Never include search/hash.
 */
export function sanitizeRequestPathForLog(
  urlOrPath: string | null | undefined,
): string {
  if (!urlOrPath) {
    return "unknown";
  }

  try {
    if (
      urlOrPath.startsWith("http://") ||
      urlOrPath.startsWith("https://")
    ) {
      return new URL(urlOrPath).pathname;
    }
  } catch {
    // fall through
  }

  const cut = urlOrPath.split(/[?#]/)[0] ?? "unknown";
  return cut || "unknown";
}

export const REDACTION_PATTERN_COUNT = PATTERNS.length;
