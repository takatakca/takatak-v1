import "server-only";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type R2FIntakeConfig =
  | { enabled: false }
  | {
      enabled: true;
      integrationId: string;
      secret: string;
      clientId: string;
    };

export function readR2FIntakeConfig(
  env: Record<string, string | undefined> = process.env,
): R2FIntakeConfig {
  if (env.R2F_INTAKE_ENABLED?.trim() !== "true") {
    return { enabled: false };
  }

  const integrationId = env.R2F_INTEGRATION_ID?.trim() ?? "";
  const secret = env.R2F_INTAKE_WEBHOOK_SECRET?.trim() ?? "";
  const clientId = env.R2F_LEADS_CLIENT_ID?.trim() ?? "";

  if (
    !integrationId ||
    secret.length < 32 ||
    !UUID_RE.test(clientId)
  ) {
    return { enabled: false };
  }

  return {
    enabled: true,
    integrationId,
    secret,
    clientId: clientId.toLowerCase(),
  };
}
