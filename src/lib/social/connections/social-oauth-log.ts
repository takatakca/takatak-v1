import "server-only";

/**
 * Structured social OAuth / sync logs.
 * Emit only stage, outcome, provider, timing, and safe count diagnostics.
 * Never emit connection IDs, job IDs, attempt IDs, Page IDs, tokens,
 * Graph URLs, or raw error bodies — even if callers pass them.
 */

export type SocialOAuthLogFields = {
  stage: string;
  outcome: string;
  provider?: string;
  /** @deprecated Accepted but never logged. */
  connectionId?: string | null;
  /** @deprecated Accepted but never logged. */
  attemptId?: string | null;
  mode?: string;
  at?: string;
  /** Safe count / classification diagnostics (never Page IDs or tokens). */
  authMode?: string;
  scopeClass?: string;
  rawCount?: number;
  eligibleCount?: number;
  insufficientAccessCount?: number;
  alreadyConnectedCount?: number;
  malformedCount?: number;
  coalesced?: boolean;
  writeCreated?: number;
  writeUpdated?: number;
  writeUnchanged?: number;
  msAuth?: number;
  msDecrypt?: number;
  msMeta?: number;
  msValidate?: number;
  msUpsert?: number;
  msEnsure?: number;
  msCas?: number;
  msTotal?: number;
  /** Safe error category only (never raw messages with secrets). */
  errorCategory?: string;
};

const ALLOWED_KEYS = new Set([
  "stage",
  "outcome",
  "provider",
  "mode",
  "at",
  "authMode",
  "scopeClass",
  "rawCount",
  "eligibleCount",
  "insufficientAccessCount",
  "alreadyConnectedCount",
  "malformedCount",
  "coalesced",
  "writeCreated",
  "writeUpdated",
  "writeUnchanged",
  "msAuth",
  "msDecrypt",
  "msMeta",
  "msValidate",
  "msUpsert",
  "msEnsure",
  "msCas",
  "msTotal",
  "errorCategory",
]);

function sanitizeFields(
  fields: SocialOAuthLogFields,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {
    stage: String(fields.stage),
    outcome: String(fields.outcome),
    at: fields.at ?? new Date().toISOString(),
  };

  const copyString = (key: keyof SocialOAuthLogFields) => {
    const value = fields[key];
    if (typeof value === "string" && value.length > 0 && ALLOWED_KEYS.has(key)) {
      out[key] = value;
    }
  };

  const copyNumber = (key: keyof SocialOAuthLogFields) => {
    const value = fields[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  };

  const copyBoolean = (key: keyof SocialOAuthLogFields) => {
    const value = fields[key];
    if (typeof value === "boolean") {
      out[key] = value;
    }
  };

  copyString("provider");
  copyString("mode");
  copyString("authMode");
  copyString("scopeClass");
  copyString("errorCategory");
  copyNumber("rawCount");
  copyNumber("eligibleCount");
  copyNumber("insufficientAccessCount");
  copyNumber("alreadyConnectedCount");
  copyNumber("malformedCount");
  copyBoolean("coalesced");
  copyNumber("writeCreated");
  copyNumber("writeUpdated");
  copyNumber("writeUnchanged");
  copyNumber("msAuth");
  copyNumber("msDecrypt");
  copyNumber("msMeta");
  copyNumber("msValidate");
  copyNumber("msUpsert");
  copyNumber("msEnsure");
  copyNumber("msCas");
  copyNumber("msTotal");

  // Explicitly never emit internal identifiers.
  delete out.connectionId;
  delete out.attemptId;

  return out;
}

export function logSocialOAuthEvent(
  scope: string,
  fields: SocialOAuthLogFields,
): void {
  console.info(
    `[${scope}]`,
    JSON.stringify(sanitizeFields(fields)),
  );
}
