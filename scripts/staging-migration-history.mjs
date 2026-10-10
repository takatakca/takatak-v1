/**
 * Match a repository migration directory to a row in
 * supabase_migrations.schema_migrations.
 *
 * Supabase stores the name without the numeric prefix
 * (20261003063500_hockey_parent_team_preferences → hockey_parent_team_preferences).
 * The statements column is a text array; joining it must use a real newline,
 * the same character that separates statements in prisma/migrations/.../migration.sql.
 */

export function migrationHistorySlug(migrationName) {
  return String(migrationName).replace(/^\d+_/, "");
}

export function supabaseHistorySql(statements) {
  return Array.isArray(statements) ? statements.join("\n") : "";
}

/**
 * Apply may run `prisma migrate deploy` only when every repository migration
 * still pending on staging is on the approved list. Any unapproved pending
 * migration keeps the old refusal, so deploy can never apply SQL nobody approved.
 */
export function canDeployApprovedPending({ pendingAfterResolve, unrelatedPending }) {
  return (
    Array.isArray(pendingAfterResolve) &&
    Array.isArray(unrelatedPending) &&
    pendingAfterResolve.length > 0 &&
    unrelatedPending.length === 0
  );
}
