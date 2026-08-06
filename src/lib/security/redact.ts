// Phase 14 — Central redaction patterns for logs, errors, and diagnostics.
// Conservative by design: redacts credible secret shapes without destroying
// harmless normal text.

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "postgres_url", re: /postgres(?:ql)?:\/\/[^\s"']+/gi },
  { name: "mysql_url", re: /mysql:\/\/[^\s"']+/gi },
  { name: "bearer_token", re: /bearer\s+[a-z0-9._~+\/=-]{12,}/gi },
  { name: "jwt", re: /eyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}/g },
  { name: "openai_key", re: /sk-[a-zA-Z0-9_-]{16,}/g },
  { name: "private_key_block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: "generic_secret_assignment", re: /((?:api[_-]?key|secret|token|password|passwd|pwd)\s*[=:]\s*)["']?[^\s"']{8,}["']?/gi },
  { name: "cookie_header", re: /(cookie\s*:\s*)[^\n]+/gi },
  { name: "authorization_header", re: /(authorization\s*:\s*)[^\n]+/gi },
];

/** Redact credible secret shapes from arbitrary text. */
export function redactSecrets(input: string): string {
  let out = input;
  for (const { re } of PATTERNS) {
    out = out.replace(re, (match, prefix?: string) =>
      typeof prefix === "string" ? `${prefix}[REDACTED]` : "[REDACTED]",
    );
  }
  return out;
}

export const REDACTION_PATTERN_COUNT = PATTERNS.length;
