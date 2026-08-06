// Phase 4 — database environment detection.
// The app must never crash or attempt queries when DB env is missing.

export interface DatabaseEnvStatus {
  configured: boolean;
  hasDatabaseUrl: boolean;
  hasDirectUrl: boolean;
}

export function getDatabaseEnvStatus(): DatabaseEnvStatus {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasDirectUrl = Boolean(process.env.DIRECT_URL);
  return { configured: hasDatabaseUrl, hasDatabaseUrl, hasDirectUrl };
}

export function isDatabaseConfigured(): boolean {
  return getDatabaseEnvStatus().configured;
}
