import { createClient, type User } from "@supabase/supabase-js";

type IdentityRow = {
  id: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  primaryEmailVerified: boolean;
  primaryPhoneVerified: boolean;
};

type ExistingSource = {
  identityId: string;
  externalUserId: string;
};

type MatchKind =
  | "existing_source_link"
  | "email"
  | "phone"
  | "email_and_phone"
  | "missing"
  | "conflict";

type Result = {
  legacyUserId: string;
  kind: MatchKind;
  identityId: string | null;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  return plus ? `+${digits}` : digits;
}

async function listAllUsers(
  client: ReturnType<typeof createClient>,
): Promise<User[]> {
  const users: User[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw new Error(`Legacy Auth read failed: ${error.message}`);

    users.push(...data.users);
    if (data.users.length < 1000) return users;
    page += 1;
  }
}

async function listAllTargetIdentities(
  client: ReturnType<typeof createClient>,
): Promise<IdentityRow[]> {
  const rows: IdentityRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from("master_identities")
      .select(
        "id,primaryEmail,primaryPhone,primaryEmailVerified,primaryPhoneVerified",
      )
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`TAKATAK identity read failed: ${error.message}`);
    }

    const batch = (data ?? []) as IdentityRow[];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
    from += pageSize;
  }
}

async function listExistingRentautoSources(
  client: ReturnType<typeof createClient>,
): Promise<ExistingSource[]> {
  const rows: ExistingSource[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from("source_profiles")
      .select("identityId,externalUserId")
      .eq("sourceApplication", "RENTAUTO")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`RENTAUTO source link read failed: ${error.message}`);
    }

    const batch = (data ?? []) as ExistingSource[];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
    from += pageSize;
  }
}

function addIndex(
  map: Map<string, Set<string>>,
  key: string | null,
  identityId: string,
) {
  if (!key) return;
  const current = map.get(key) ?? new Set<string>();
  current.add(identityId);
  map.set(key, current);
}

function one(set: Set<string> | undefined): string | null {
  if (!set || set.size !== 1) return null;
  return [...set][0] ?? null;
}

async function main() {
  const legacyUrl = required("RENTAUTO_LEGACY_SUPABASE_URL");
  const legacyServiceRole = required(
    "RENTAUTO_LEGACY_SUPABASE_SERVICE_ROLE_KEY",
  );
  const targetUrl =
    process.env.TAKATAK_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    required("NEXT_PUBLIC_SUPABASE_URL");
  const targetServiceRole =
    process.env.TAKATAK_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    "";

  if (!targetServiceRole) {
    throw new Error(
      "Missing TAKATAK_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY",
    );
  }

  if (new URL(legacyUrl).host === new URL(targetUrl).host) {
    throw new Error("Legacy and TAKATAK Supabase hosts must be different");
  }

  const legacy = createClient(legacyUrl, legacyServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const target = createClient(targetUrl, targetServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [legacyUsers, identities, existingSources] = await Promise.all([
    listAllUsers(legacy),
    listAllTargetIdentities(target),
    listExistingRentautoSources(target),
  ]);

  const emailIndex = new Map<string, Set<string>>();
  const phoneIndex = new Map<string, Set<string>>();

  for (const identity of identities) {
    if (identity.primaryEmailVerified) {
      addIndex(
        emailIndex,
        normalizeEmail(identity.primaryEmail),
        identity.id,
      );
    }
    if (identity.primaryPhoneVerified) {
      addIndex(
        phoneIndex,
        normalizePhone(identity.primaryPhone),
        identity.id,
      );
    }
  }

  const existingByLegacyUser = new Map(
    existingSources.map((source) => [source.externalUserId, source.identityId]),
  );

  const results: Result[] = legacyUsers.map((user) => {
    const existing = existingByLegacyUser.get(user.id);
    if (existing) {
      return {
        legacyUserId: user.id,
        kind: "existing_source_link",
        identityId: existing,
      };
    }

    const verifiedEmail =
      user.email_confirmed_at ? normalizeEmail(user.email) : null;
    const verifiedPhone =
      user.phone_confirmed_at ? normalizePhone(user.phone) : null;

    const emailMatches = verifiedEmail
      ? emailIndex.get(verifiedEmail)
      : undefined;
    const phoneMatches = verifiedPhone
      ? phoneIndex.get(verifiedPhone)
      : undefined;

    if ((emailMatches?.size ?? 0) > 1 || (phoneMatches?.size ?? 0) > 1) {
      return {
        legacyUserId: user.id,
        kind: "conflict",
        identityId: null,
      };
    }

    const emailIdentity = one(emailMatches);
    const phoneIdentity = one(phoneMatches);

    if (emailIdentity && phoneIdentity && emailIdentity !== phoneIdentity) {
      return {
        legacyUserId: user.id,
        kind: "conflict",
        identityId: null,
      };
    }

    if (emailIdentity && phoneIdentity) {
      return {
        legacyUserId: user.id,
        kind: "email_and_phone",
        identityId: emailIdentity,
      };
    }

    if (emailIdentity) {
      return {
        legacyUserId: user.id,
        kind: "email",
        identityId: emailIdentity,
      };
    }

    if (phoneIdentity) {
      return {
        legacyUserId: user.id,
        kind: "phone",
        identityId: phoneIdentity,
      };
    }

    return {
      legacyUserId: user.id,
      kind: "missing",
      identityId: null,
    };
  });

  const counts = results.reduce<Record<MatchKind, number>>(
    (acc, result) => {
      acc[result.kind] += 1;
      return acc;
    },
    {
      existing_source_link: 0,
      email: 0,
      phone: 0,
      email_and_phone: 0,
      missing: 0,
      conflict: 0,
    },
  );

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "READ_ONLY_IDENTITY_MAPPING",
    legacyAuthUsers: legacyUsers.length,
    targetMasterIdentities: identities.length,
    existingRentautoSourceLinks: existingSources.length,
    mapping: counts,
    gates: {
      conflictsZero: counts.conflict === 0,
      allLegacyUsersResolvable:
        counts.missing === 0 && counts.conflict === 0,
      safeToProceedAutomatically:
        counts.missing === 0 && counts.conflict === 0,
    },
    note:
      "This command prints counts only. It never creates identities, changes roles, or exposes emails/phones.",
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (counts.conflict > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(
    "[rentauto-cutover-map-identities]",
    error instanceof Error ? error.message : "unknown_error",
  );
  process.exit(1);
});
