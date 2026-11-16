/**
 * Creative Intelligence is a private, opt-in, per-client production canary.
 * Never derive the client ID from request query/body/headers; use signed workspace context.
 * All settings are server-only and require an explicit enable + exact UUID allowlist.
 */
const CLIENT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CANARY_CLIENTS = 50;
const MAX_CONFIG_LENGTH = 1900;

export function isCreativeIntelligenceCanaryEnabled(
  clientId: string,
  config: { enabled: string | undefined; clientIds: string | undefined },
): boolean {
  if (config.enabled !== "true" || !CLIENT_UUID.test(clientId)) return false;
  const raw = config.clientIds?.trim() ?? "";
  if (!raw || raw.length > MAX_CONFIG_LENGTH) return false;
  const candidates = raw.split(",").map((id) => id.trim());
  if (candidates.length > MAX_CANARY_CLIENTS || candidates.some((id) => !CLIENT_UUID.test(id))) return false;
  return candidates.some((id) => id.toLowerCase() === clientId.toLowerCase());
}

export function isCreativeIntelligenceEnabledForClient(clientId: string): boolean {
  return isCreativeIntelligenceCanaryEnabled(clientId, {
    enabled: process.env.TAKATAK_CREATIVE_INTELLIGENCE_ENABLED,
    clientIds: process.env.TAKATAK_CREATIVE_INTELLIGENCE_CANARY_CLIENT_IDS,
  });
}
