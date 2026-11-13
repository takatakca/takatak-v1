/**
 * Permanent operator-controlled workspace exemption.
 * This uses the existing SOCIAL_CONNECTION_SETUP_CLIENT_IDS allowlist so
 * deployments need no second list or database writes.
 *
 * Supported comma-separated entries:
 * - workspace UUID (legacy)
 * - client-name:workspace-UUID (operator-friendly label)
 *
 * Labels are not authorization identifiers: only exact workspace UUIDs match.
 * Never match a profile/user UID. Production reads the env server-side.
 */
export const BILLING_EXEMPT_WORKSPACE_IDS_ENV =
  'SOCIAL_CONNECTION_SETUP_CLIENT_IDS';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Deliberately restrict labels to simple human-readable names, not arbitrary
// delimiters, so malformed entries cannot accidentally grant access.
const WORKSPACE_LABEL_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

function configuredWorkspaceUuid(entry: string): string | null {
  const value = entry.trim();
  const separator = value.indexOf(':');
  if (separator < 0) {
    return UUID_PATTERN.test(value) ? value.toLowerCase() : null;
  }
  // Only one colon, a nonempty valid label, and a valid UUID are allowed.
  const label = value.slice(0, separator).trim();
  const uuid = value.slice(separator + 1).trim();
  return WORKSPACE_LABEL_PATTERN.test(label) && UUID_PATTERN.test(uuid)
    ? uuid.toLowerCase()
    : null;
}

export function isBillingExemptWorkspace(
  clientId: string,
  configuredIds: string | null | undefined =
    process.env.SOCIAL_CONNECTION_SETUP_CLIENT_IDS,
): boolean {
  const id = clientId.trim().toLowerCase();
  if (!UUID_PATTERN.test(id) || !configuredIds) return false;
  return configuredIds
    .split(',')
    .some((entry) => configuredWorkspaceUuid(entry) === id);
}
