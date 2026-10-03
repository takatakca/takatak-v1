export type AhmvCapability =
  | "stripe_membership"
  | "supporter_credit"
  | "event_sync"
  | "sms_delivery"
  | "google_calendar";

export type AhmvReadinessCheck = {
  capability: AhmvCapability;
  enabled: boolean;
  ready: boolean;
  missing: string[];
  invalid: string[];
};

export type AhmvBackendReadiness = {
  ready: boolean;
  productionSafe: boolean;
  checks: AhmvReadinessCheck[];
};

type Env = Record<string, string | undefined>;

function value(env: Env, name: string): string {
  return env[name]?.trim() ?? "";
}

function enabled(env: Env, name: string): boolean {
  return value(env, name) === "true";
}

function secretLengthOk(env: Env, name: string, minimum = 32): boolean {
  const current = value(env, name);
  return !current || current.length >= minimum;
}

function httpsUrlOk(raw: string, expectedPath?: string): boolean {
  if (!raw) return true;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    if (expectedPath && url.pathname !== expectedPath) return false;
    return true;
  } catch {
    return false;
  }
}

function encryptionKeyOk(raw: string): boolean {
  if (!raw) return true;
  try {
    if (Buffer.from(raw, "base64").length === 32) return true;
  } catch {
    // Try hex.
  }
  return /^[a-fA-F0-9]{64}$/.test(raw);
}

function checkCapability(
  capability: AhmvCapability,
  isEnabled: boolean,
  requirements: Array<{
    name: string;
    present: boolean;
    valid?: boolean;
  }>,
): AhmvReadinessCheck {
  if (!isEnabled) {
    return {
      capability,
      enabled: false,
      ready: true,
      missing: [],
      invalid: [],
    };
  }

  const missing = requirements
    .filter((item) => !item.present)
    .map((item) => item.name);

  const invalid = requirements
    .filter((item) => item.present && item.valid === false)
    .map((item) => item.name);

  return {
    capability,
    enabled: true,
    ready: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

export function collectAhmvBackendReadiness(
  env: Env = process.env,
): AhmvBackendReadiness {
  const stripe = checkCapability(
    "stripe_membership",
    enabled(env, "HOCKEY_MEMBERSHIP_SELF_SERVE_ENABLED"),
    [
      {
        name: "STRIPE_SECRET_KEY",
        present: Boolean(value(env, "STRIPE_SECRET_KEY")),
      },
      {
        name: "STRIPE_HOCKEY_WEBHOOK_SECRET",
        present: Boolean(value(env, "STRIPE_HOCKEY_WEBHOOK_SECRET")),
        valid: secretLengthOk(env, "STRIPE_HOCKEY_WEBHOOK_SECRET"),
      },
      {
        name: "STRIPE_PRICE_HOCKEY_MEMBER_WEEKLY_10",
        present: Boolean(value(env, "STRIPE_PRICE_HOCKEY_MEMBER_WEEKLY_10")),
      },
    ],
  );

  const supporter = checkCapability(
    "supporter_credit",
    enabled(env, "AHMV_SUPPORTER_SYNC_ENABLED"),
    [
      {
        name: "AHMV_SUPPORTER_SYNC_CLIENT_ID",
        present: Boolean(value(env, "AHMV_SUPPORTER_SYNC_CLIENT_ID")),
      },
      {
        name: "AHMV_SUPPORTER_SYNC_WEBHOOK_SECRET",
        present: Boolean(value(env, "AHMV_SUPPORTER_SYNC_WEBHOOK_SECRET")),
        valid: secretLengthOk(env, "AHMV_SUPPORTER_SYNC_WEBHOOK_SECRET"),
      },
    ],
  );

  const eventSync = checkCapability(
    "event_sync",
    enabled(env, "AHMV_EVENT_SYNC_ENABLED"),
    [
      {
        name: "AHMV_EVENT_SYNC_CLIENT_ID",
        present: Boolean(value(env, "AHMV_EVENT_SYNC_CLIENT_ID")),
      },
      {
        name: "AHMV_EVENT_SYNC_WEBHOOK_SECRET",
        present: Boolean(value(env, "AHMV_EVENT_SYNC_WEBHOOK_SECRET")),
        valid: secretLengthOk(env, "AHMV_EVENT_SYNC_WEBHOOK_SECRET"),
      },
      {
        name: "AHMV_EVENT_REQUIRE_SOURCE_URL",
        present: value(env, "AHMV_EVENT_REQUIRE_SOURCE_URL") === "true",
      },
      {
        name: "AHMV_EVENT_ALLOWED_SOURCE_HOSTS",
        present: Boolean(value(env, "AHMV_EVENT_ALLOWED_SOURCE_HOSTS")),
      },
    ],
  );

  const sms = checkCapability(
    "sms_delivery",
    enabled(env, "HOCKEY_SMS_ENABLED") ||
      enabled(env, "HOCKEY_DELIVERY_WORKER_ENABLED"),
    [
      {
        name: "HOCKEY_SMS_ENABLED",
        present: enabled(env, "HOCKEY_SMS_ENABLED"),
      },
      {
        name: "HOCKEY_DELIVERY_WORKER_ENABLED",
        present: enabled(env, "HOCKEY_DELIVERY_WORKER_ENABLED"),
      },
      {
        name: "TWILIO_ACCOUNT_SID",
        present: Boolean(value(env, "TWILIO_ACCOUNT_SID")),
      },
      {
        name: "TWILIO_AUTH_TOKEN",
        present: Boolean(value(env, "TWILIO_AUTH_TOKEN")),
      },
      {
        name: "TWILIO_MESSAGING_SERVICE_SID_OR_SMS_FROM",
        present: Boolean(
          value(env, "TWILIO_MESSAGING_SERVICE_SID") ||
            value(env, "TWILIO_SMS_FROM"),
        ),
      },
      {
        name: "HOCKEY_DELIVERY_WORKER_SECRET",
        present: Boolean(value(env, "HOCKEY_DELIVERY_WORKER_SECRET")),
        valid: secretLengthOk(env, "HOCKEY_DELIVERY_WORKER_SECRET"),
      },
    ],
  );

  const google = checkCapability(
    "google_calendar",
    enabled(env, "HOCKEY_GOOGLE_CALENDAR_ENABLED"),
    [
      {
        name: "GOOGLE_HOCKEY_CLIENT_ID",
        present: Boolean(value(env, "GOOGLE_HOCKEY_CLIENT_ID")),
      },
      {
        name: "GOOGLE_HOCKEY_CLIENT_SECRET",
        present: Boolean(value(env, "GOOGLE_HOCKEY_CLIENT_SECRET")),
      },
      {
        name: "GOOGLE_HOCKEY_REDIRECT_URI",
        present: Boolean(value(env, "GOOGLE_HOCKEY_REDIRECT_URI")),
        valid: httpsUrlOk(
          value(env, "GOOGLE_HOCKEY_REDIRECT_URI"),
          "/api/hockey/calendar/google/callback",
        ),
      },
      {
        name: "HOCKEY_TOKEN_ENCRYPTION_KEY_V1",
        present: Boolean(value(env, "HOCKEY_TOKEN_ENCRYPTION_KEY_V1")),
        valid: encryptionKeyOk(value(env, "HOCKEY_TOKEN_ENCRYPTION_KEY_V1")),
      },
    ],
  );

  const checks = [stripe, supporter, eventSync, sms, google];
  const ready = checks.every((item) => item.ready);

  const productionSafe =
    ready &&
    (value(env, "NODE_ENV") !== "production" ||
      !eventSync.enabled ||
      (value(env, "AHMV_EVENT_REQUIRE_SOURCE_URL") === "true" &&
        Boolean(value(env, "AHMV_EVENT_ALLOWED_SOURCE_HOSTS"))));

  return {
    ready,
    productionSafe,
    checks,
  };
}

export function summarizeAhmvBackendReadiness(
  result: AhmvBackendReadiness,
) {
  return {
    ready: result.ready,
    productionSafe: result.productionSafe,
    capabilities: result.checks.map((check) => ({
      capability: check.capability,
      enabled: check.enabled,
      ready: check.ready,
      missing: check.missing,
      invalid: check.invalid,
    })),
  };
}
