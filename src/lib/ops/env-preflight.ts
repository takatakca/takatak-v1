export type EnvClass = "required" | "optional" | "feature";

export type EnvCheck = {
  name: string;
  present: boolean;
  classification: EnvClass;
  formatOk: boolean;
  message?: string;
};

export type PreflightResult = {
  ok: boolean;
  missingRequired: string[];
  invalid: string[];
  checks: EnvCheck[];
};

function present(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function firstPresent(names: string[]): string | null {
  return names.find((name) => present(name)) ?? null;
}

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

function looksLikePostgresUrl(value: string): boolean {
  return /^(postgres(?:ql)?:\/\/)/i.test(value);
}

function check(
  name: string,
  classification: EnvClass,
  extra?: { formatOk?: boolean; message?: string; present?: boolean },
): EnvCheck {
  const isPresent = extra?.present ?? present(name);
  return {
    name,
    present: isPresent,
    classification,
    formatOk: extra?.formatOk ?? true,
    message: extra?.message,
  };
}

export function collectEnvPreflight(): PreflightResult {
  const checks: EnvCheck[] = [];

  checks.push(check("NODE_ENV", "optional"));
  checks.push(check("DATABASE_URL", "required", {
    formatOk: !present("DATABASE_URL") || looksLikePostgresUrl(process.env.DATABASE_URL ?? ""),
    message: present("DATABASE_URL") && !looksLikePostgresUrl(process.env.DATABASE_URL ?? "")
      ? "DATABASE_URL must be a postgres URL"
      : undefined,
  }));
  checks.push(check("DIRECT_URL", "optional", {
    formatOk: !present("DIRECT_URL") || looksLikePostgresUrl(process.env.DIRECT_URL ?? ""),
  }));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  checks.push(check("NEXT_PUBLIC_SUPABASE_URL", "required", {
    formatOk: !present("NEXT_PUBLIC_SUPABASE_URL") || isHttpsUrl(supabaseUrl),
  }));
  checks.push(check("NEXT_PUBLIC_SUPABASE_ANON_KEY", "required"));
  checks.push(check("SUPABASE_SECRET_KEY", "required", {
    present: Boolean(firstPresent(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"])),
    message: firstPresent(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"])
      ? undefined
      : "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required",
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  checks.push(check("NEXT_PUBLIC_APP_URL", "required", {
    formatOk: !present("NEXT_PUBLIC_APP_URL") || isHttpsUrl(appUrl),
  }));

  const emailConfigured =
    (present("EMAIL_USER") && present("EMAIL_PASSWORD")) ||
    present("SENDGRID_API_KEY");
  checks.push(check("EMAIL_USER", "required", {
    present: emailConfigured,
    message: emailConfigured
      ? undefined
      : "EMAIL_USER+EMAIL_PASSWORD or SENDGRID_API_KEY is required for OTP",
  }));
  checks.push(check("EMAIL_PASSWORD", "optional"));
  checks.push(check("SENDGRID_API_KEY", "optional"));
  checks.push(check("SENDER_EMAIL", "optional"));

  const phoneEnabled =
    present("TWILIO_ACCOUNT_SID") ||
    present("TWILIO_AUTH_TOKEN") ||
    present("TWILIO_VERIFY_SERVICE_SID");
  if (phoneEnabled) {
    for (const name of [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_VERIFY_SERVICE_SID",
    ]) {
      checks.push(check(name, "feature"));
    }
  } else {
    checks.push(check("TWILIO_ACCOUNT_SID", "optional"));
  }

  const stripeEnabled =
    present("STRIPE_SECRET_KEY") || present("STRIPE_WEBHOOK_SECRET");
  if (stripeEnabled) {
    checks.push(check("STRIPE_SECRET_KEY", "feature"));
    checks.push(check("STRIPE_WEBHOOK_SECRET", "feature"));
  } else {
    checks.push(check("STRIPE_SECRET_KEY", "optional"));
    checks.push(check("STRIPE_WEBHOOK_SECRET", "optional"));
  }

  const upmindEnabled =
    present("UPMIND_API_KEY") ||
    present("UPMIND_KEY") ||
    present("UPMIND_API_BASE_URL");
  if (upmindEnabled) {
    checks.push(check("UPMIND_API_KEY", "feature", {
      present: Boolean(firstPresent(["UPMIND_API_KEY", "UPMIND_KEY"])),
    }));
    checks.push(check("UPMIND_API_BASE_URL", "feature"));
  } else {
    checks.push(check("UPMIND_API_KEY", "optional"));
    checks.push(check("UPMIND_API_BASE_URL", "optional"));
  }

  if (present("NEXT_PUBLIC_APP_URL") && present("NEXT_PUBLIC_SUPABASE_URL")) {
    try {
      const appOrigin = new URL(appUrl).origin;
      const supabaseOrigin = new URL(supabaseUrl).origin;
      if (appOrigin === supabaseOrigin) {
        checks.push({
          name: "APP_SUPABASE_ORIGIN_DISTINCT",
          present: true,
          classification: "required",
          formatOk: false,
          message: "NEXT_PUBLIC_APP_URL must not equal the Supabase URL",
        });
      }
    } catch {
      // Format errors already recorded on the URL fields.
    }
  }

  const missingRequired = [
    ...new Set(
      checks
        .filter((item) => item.classification === "required" && !item.present)
        .map((item) => item.name),
    ),
  ];
  const invalid = checks
    .filter((item) => item.present && !item.formatOk)
    .map((item) => item.name);
  const featureIncomplete = checks
    .filter((item) => item.classification === "feature" && !item.present)
    .map((item) => item.name);

  return {
    ok: missingRequired.length === 0 && invalid.length === 0 && featureIncomplete.length === 0,
    missingRequired,
    invalid: [...invalid, ...featureIncomplete],
    checks,
  };
}

export function essentialAuthConfigured(): boolean {
  return (
    present("DATABASE_URL") &&
    present("NEXT_PUBLIC_SUPABASE_URL") &&
    present("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
    Boolean(firstPresent(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]))
  );
}
