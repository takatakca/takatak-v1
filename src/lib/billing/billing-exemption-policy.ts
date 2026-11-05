/**
 * Permanent operator-controlled workspace exemption.
 * This uses the existing SOCIAL_CONNECTION_SETUP_CLIENT_IDS allowlist so
 * deployments need no second list or database writes.
 *
 * Only exact UUID workspace IDs match. Never match a profile/user UID.
 * Production reads this environment variable at request time (server-side).
 * Removal from the list immediately restores normal billing gates.
 */
export const BILLING_EXEMPT_WORKSPACE_IDS_ENV =
  'SOCIAL_CONNECTION_SETUP_CLIENT_IDS';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBillingExemptWorkspace(
  clientId: string,
  configuredIds: string | null | undefined =
    process.env.SOCIAL_CONNECTION_SETUP_CLIENT_IDS,
): boolean {
  const id = clientId.trim().toLowerCase();
  if (!UUID_PATTERN.test(id) || !configuredIds) return false;
  return configuredIds
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => UUID_PATTERN.test(value))
    .includes(id);
}
