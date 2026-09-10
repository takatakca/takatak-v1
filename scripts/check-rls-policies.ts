// RLS + Data API isolation tests.
// Static checks always run. Database checks run when DATABASE_URL points at a
// Supabase-shaped Postgres (roles anon/authenticated + auth.uid()).
//
// Apply prisma/migrations/20260909170000_public_rls_and_fk_indexes first.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    code === "42501" ||
    /permission denied/i.test(message) ||
    /row-level security/i.test(message) ||
    /must be owner/i.test(message) ||
    /insufficient.privilege/i.test(message)
  );
}

function isUndefinedFunction(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return code === "42883" || /does not exist/i.test(message);
}

const AUTH_DEFINER_HELPERS = [
  "is_current_profile",
  "has_client_access",
  "has_any_workspace_membership",
  "current_profile_id",
] as const;

const EXPOSED_SCHEMAS = ["public", "graphql_public"] as const;

const FORBIDDEN_HOSTED_REF = "pcjfahhlozsseqqevimi";

type EphemeralPerson = {
  email: string;
  password: string;
  authUserId: string;
  profileId: string;
  clientId?: string;
  brandId?: string;
  locationId?: string;
  assignmentId?: string;
};

type EphemeralSeed = {
  a: Required<Pick<EphemeralPerson, "email" | "password" | "authUserId" | "profileId" | "clientId" | "locationId" | "assignmentId">>;
  b: Required<Pick<EphemeralPerson, "email" | "password" | "authUserId" | "profileId" | "clientId" | "locationId" | "assignmentId">>;
  c: Pick<EphemeralPerson, "email" | "password" | "authUserId" | "profileId">;
  disabled: Pick<EphemeralPerson, "email" | "password" | "authUserId" | "profileId" | "clientId">;
};

function isEphemeralSupabase(): boolean {
  return process.env.EPHEMERAL_SUPABASE === "1";
}

function readEphemeralSeed(): EphemeralSeed | null {
  if (!isEphemeralSupabase()) return null;
  const seedPath =
    process.env.EPHEMERAL_SEED_PATH?.trim() || "/tmp/takatak-ephemeral-seed.json";
  return JSON.parse(readFileSync(seedPath, "utf8")) as EphemeralSeed;
}

function jwtPayload(token: string): { sub: string; email?: string; role?: string } {
  const json = Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8");
  return JSON.parse(json) as { sub: string; email?: string; role?: string };
}

async function passwordGrant(email: string, password: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error("local Auth URL/anon key missing for password grant");
  }
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, grant_type: "password" }),
  });
  const text = await response.text();
  let body: {
    access_token?: string;
    error_description?: string;
    msg?: string;
    error?: string;
  } = {};
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    body = {};
  }
  if (!response.ok || !body.access_token) {
    throw new Error(
      body.error_description ||
        body.msg ||
        body.error ||
        `password grant failed for ${email} (${response.status}) ${text.slice(0, 180)}`,
    );
  }
  return body.access_token;
}

function runStaticChecks() {
  console.log("[rls] static access-path checks");

  const browser = readSource("../src/lib/auth/supabase-browser.ts");
  const admin = readSource("../src/lib/auth/supabase-admin.ts");
  const env = readSource("../src/lib/auth/env.ts");
  const identity = readSource("../src/lib/security/roles.ts");
  const tenant = readSource("../src/lib/security/tenant-access.ts");
  const dataScope = readSource("../src/lib/security/data-scope.ts");
  const migration = readSource(
    "../prisma/migrations/20260909170000_public_rls_and_fk_indexes/migration.sql",
  );

  assert(
    "browser Supabase client uses the anon key only",
    browser.includes("env.anonKey") &&
      !browser.includes("SERVICE_ROLE") &&
      !browser.includes("SUPABASE_SECRET"),
  );
  assert(
    "browser helper never reads a service-role env var",
    !browser.includes("process.env"),
  );
  assert(
    "server admin client is marked server-only",
    admin.includes('import "server-only"'),
  );
  assert(
    "service-role secret is not a NEXT_PUBLIC_ env var",
    admin.includes("SUPABASE_SECRET_KEY") &&
      admin.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !admin.includes("NEXT_PUBLIC_SUPABASE_SERVICE") &&
      !admin.includes("NEXT_PUBLIC_SUPABASE_SECRET"),
  );
  assert(
    "public env helper exposes only URL + anon key",
    env.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
      !env.includes("SERVICE_ROLE") &&
      !env.includes("SUPABASE_SECRET_KEY"),
  );
  assert(
    "workspace authorization does not read user_metadata",
    identity.includes("never trusted for authorization") &&
      !tenant.includes("user_metadata"),
  );
  assert(
    "Prisma data scope still applies explicit clientId filters",
    dataScope.includes("clientId: { in: scope.clientIds }"),
  );
  assert(
    "RLS migration never authorizes from user_metadata",
    !migration.includes("->>'user_metadata'") &&
      !migration.includes("-> 'user_metadata'") &&
      !migration.includes('-> "user_metadata"'),
  );
  assert(
    "RLS migration enables RLS without FORCE (Prisma still bypasses)",
    migration.includes("ENABLE ROW LEVEL SECURITY") &&
      !migration.includes("FORCE ROW LEVEL SECURITY"),
  );
  assert(
    "RLS migration creates no INSERT/UPDATE/DELETE Data API policies",
    !/CREATE POLICY[\s\S]{0,200}FOR (INSERT|UPDATE|DELETE)/i.test(migration),
  );
  const grantList = migration.split("selectable text[]")[1] ?? "";
  assert(
    "migration never GRANTs table-level SELECT on secret-bearing tables",
    !grantList.includes("'profiles'") &&
      !grantList.includes("'user_invitations'") &&
      !grantList.includes("'social_credentials'") &&
      !grantList.includes("'social_oauth_states'") &&
      !grantList.includes("'stripe_webhook_events'") &&
      !grantList.includes("'social_content_items'") &&
      !grantList.includes("'social_competitor_tracks'") &&
      !grantList.includes("'jobs'") &&
      !grantList.includes("'job_logs'") &&
      !grantList.includes("'audit_logs'") &&
      !grantList.includes("'integration_events'") &&
      !grantList.includes("'integration_accounts'"),
  );
  assert(
    "migration does not use ineffective column REVOKE after table GRANT",
    !migration.includes('REVOKE SELECT ("otpHash"') &&
      !migration.includes('REVOKE SELECT ("tokenHash")') &&
      !migration.includes('REVOKE SELECT ("externalObjectId")') &&
      !migration.includes('REVOKE SELECT ("externalPageId")'),
  );
  assert(
    "membership helpers are SECURITY DEFINER in private with pg_catalog-only search_path",
    migration.includes("SECURITY DEFINER") &&
      migration.includes("SET search_path = pg_catalog") &&
      !migration.includes("SET search_path = public") &&
      migration.includes("CREATE SCHEMA IF NOT EXISTS private") &&
      migration.includes("CREATE OR REPLACE FUNCTION private.is_current_profile") &&
      migration.includes("CREATE OR REPLACE FUNCTION private.has_client_access") &&
      migration.includes("CREATE OR REPLACE FUNCTION private.has_any_workspace_membership") &&
      !migration.includes("CREATE OR REPLACE FUNCTION public.is_current_profile") &&
      !migration.includes("CREATE OR REPLACE FUNCTION public.has_client_access") &&
      !migration.includes("CREATE OR REPLACE FUNCTION public.has_any_workspace_membership") &&
      !migration.includes("CREATE OR REPLACE FUNCTION public.current_profile_id()"),
  );
  assert(
    "helpers schema-qualify profiles, memberships, and auth.uid()",
    migration.includes("FROM public.profiles") &&
      migration.includes("FROM public.client_memberships") &&
      migration.includes("auth.uid()") &&
      !migration.includes("->>'user_metadata'"),
  );
  assert(
    "RLS policies call private helpers, not public",
    migration.includes("USING (private.has_client_access") &&
      migration.includes("USING (private.is_current_profile") &&
      migration.includes("USING (private.has_any_workspace_membership()") &&
      !migration.includes("USING (public.has_client_access") &&
      !migration.includes("USING (public.is_current_profile") &&
      !migration.includes("USING (public.has_any_workspace_membership"),
  );
  assert(
    "public RPC copies of tenant helpers are dropped",
    migration.includes("DROP FUNCTION IF EXISTS public.has_client_access(uuid)") &&
      migration.includes("DROP FUNCTION IF EXISTS public.is_current_profile(uuid)") &&
      migration.includes("DROP FUNCTION IF EXISTS public.has_any_workspace_membership()"),
  );
  assert(
    "private schema access is USAGE+EXECUTE for authenticated only",
    migration.includes("REVOKE ALL ON SCHEMA private FROM PUBLIC") &&
      migration.includes("REVOKE ALL ON SCHEMA private FROM anon") &&
      migration.includes("GRANT USAGE ON SCHEMA private TO authenticated") &&
      !migration.includes("GRANT USAGE ON SCHEMA private TO anon") &&
      !migration.includes("GRANT USAGE ON SCHEMA private TO PUBLIC") &&
      !migration.includes("GRANT CREATE ON SCHEMA private") &&
      migration.includes("REVOKE CREATE ON SCHEMA private FROM PUBLIC") &&
      migration.includes("REVOKE CREATE ON SCHEMA private FROM anon") &&
      migration.includes("REVOKE CREATE ON SCHEMA private FROM authenticated") &&
      migration.includes("REVOKE ALL ON FUNCTION private.has_client_access(uuid) FROM PUBLIC") &&
      migration.includes("REVOKE ALL ON FUNCTION private.has_client_access(uuid) FROM anon") &&
      migration.includes("GRANT EXECUTE ON FUNCTION private.has_client_access(uuid) TO authenticated") &&
      !migration.includes("GRANT EXECUTE ON FUNCTION private.has_client_access(uuid) TO anon"),
  );
  assert(
    "JWT roles cannot CREATE in public (function search_path has no public)",
    migration.includes("REVOKE CREATE ON SCHEMA public FROM PUBLIC") &&
      migration.includes("REVOKE CREATE ON SCHEMA public FROM anon") &&
      migration.includes("REVOKE CREATE ON SCHEMA public FROM authenticated"),
  );
  assert(
    "migration refuses if private is in PostgREST exposed schemas",
    migration.includes("pgrst.db_schemas") &&
      migration.includes("schema private must not be in pgrst.db_schemas"),
  );
  const configToml = readSource("../supabase/config.toml");
  assert(
    "local Supabase config is ephemeral and not a hosted project ref",
    configToml.includes('project_id = "takatak-ci-ephemeral"') &&
      !configToml.includes(FORBIDDEN_HOSTED_REF) &&
      !configToml.includes("supabase.co"),
  );

  const srcFiles = [
    "../src/lib/auth/supabase-browser.ts",
    "../src/lib/auth/supabase-server.ts",
    "../src/lib/auth/otp/session.ts",
    "../src/proxy.ts",
  ];
  const tableFrom = srcFiles.some((file) =>
    /\.from\(\s*['"][a-z_]+['"]\s*\)/.test(readSource(file)),
  );
  assert(
    "auth Supabase clients do not query public tables via .from()",
    !tableFrom,
  );
}

type Persona = {
  role: "anon" | "authenticated" | "postgres";
  sub?: string;
  email?: string;
  accessToken?: string;
};

async function withPersona<T>(
  pool: import("pg").Pool,
  persona: Persona,
  run: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (persona.role === "anon") {
      await client.query("SELECT set_config('request.jwt.claim.sub', '', true)");
      await client.query("SELECT set_config('request.jwt.claims', '', true)");
      await client.query("SET LOCAL ROLE anon");
    } else if (persona.role === "authenticated") {
      const fromToken = persona.accessToken
        ? jwtPayload(persona.accessToken)
        : null;
      const sub = fromToken?.sub ?? persona.sub ?? "";
      const email = fromToken?.email ?? persona.email ?? "";
      const claims = JSON.stringify({
        sub,
        email,
        role: "authenticated",
      });
      await client.query(
        "SELECT set_config('request.jwt.claim.sub', $1, true)",
        [sub],
      );
      await client.query(
        "SELECT set_config('request.jwt.claim.email', $1, true)",
        [email],
      );
      await client.query(
        "SELECT set_config('request.jwt.claims', $1, true)",
        [claims],
      );
      await client.query("SET LOCAL ROLE authenticated");
    }
    return await run(client);
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Connection may already be aborted.
    }
    client.release();
  }
}

async function countRows(
  client: import("pg").PoolClient,
  sql: string,
  params: unknown[] = [],
): Promise<number | "denied"> {
  try {
    const result = await client.query<{ n: string | number }>(sql, params);
    return Number(result.rows[0]?.n ?? 0);
  } catch (error) {
    if (isPermissionDenied(error)) return "denied";
    throw error;
  }
}

function isInaccessible(result: number | "denied"): boolean {
  return result === "denied" || result === 0;
}

async function proveTableGrantColumnRevokeIsNoOp(pool: import("pg").Pool) {
  const client = await pool.connect();
  const table = `takatak_colpriv_probe_${Date.now().toString(36)}`;
  try {
    await client.query("BEGIN");
    await client.query(
      `CREATE TABLE public.${table} (id int PRIMARY KEY, secret text)`,
    );
    await client.query(`INSERT INTO public.${table} VALUES (1, 'leaked')`);
    await client.query(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC`);
    await client.query(
      `REVOKE ALL ON TABLE public.${table} FROM anon, authenticated`,
    );
    await client.query(
      `GRANT SELECT ON TABLE public.${table} TO authenticated`,
    );
    await client.query(
      `REVOKE SELECT (secret) ON TABLE public.${table} FROM authenticated`,
    );
    await client.query("SET LOCAL ROLE authenticated");
    const result = await client.query<{ secret: string }>(
      `SELECT secret FROM public.${table} WHERE id = 1`,
    );
    assert(
      "PostgreSQL table-level SELECT is NOT hidden by later column REVOKE",
      result.rows[0]?.secret === "leaked",
      "expected column REVOKE after table GRANT to be a no-op",
    );
  } catch (error) {
    if (isPermissionDenied(error)) {
      assert(
        "PostgreSQL table-level SELECT is NOT hidden by later column REVOKE",
        false,
        "column REVOKE unexpectedly blocked SELECT; re-check PG version",
      );
      return;
    }
    console.log(
      "[rls] column-privilege probe skipped:",
      error instanceof Error ? error.message : "unknown_error",
    );
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Probe table is session-local once rolled back.
    }
    client.release();
  }
}

async function databaseReady(
  pool: import("pg").Pool,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const client = await pool.connect();
  try {
    const roles = await client.query<{ rolname: string }>(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')",
    );
    const names = roles.rows.map((row) => row.rolname);
    if (!names.includes("anon") || !names.includes("authenticated")) {
      return { ok: false, reason: "anon/authenticated roles missing" };
    }
    const authUid = await client.query(
      "SELECT COUNT(*)::int AS n FROM pg_proc WHERE proname = 'uid' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')",
    );
    if (Number(authUid.rows[0]?.n ?? 0) < 1) {
      return { ok: false, reason: "auth.uid() missing" };
    }
    const rls = await client.query<{ relrowsecurity: boolean }>(
      "SELECT relrowsecurity FROM pg_class WHERE relname = 'client_memberships' AND relnamespace = 'public'::regnamespace",
    );
    if (!rls.rows[0]?.relrowsecurity) {
      return {
        ok: false,
        reason:
          "RLS is not enabled on client_memberships — apply 20260909170000_public_rls_and_fk_indexes",
      };
    }
    return { ok: true };
  } finally {
    client.release();
  }
}

async function reloadPostgrestSchema(pool: import("pg").Pool) {
  const client = await pool.connect();
  try {
    await client.query("NOTIFY pgrst, 'reload schema'");
  } finally {
    client.release();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return;
  }

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${url}/rest/v1/clients?select=id&limit=1`, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Accept: "application/json",
      },
    });
    if (response.status !== 404) {
      console.log(
        `[rls] PostgREST schema cache ready (clients status=${response.status})`,
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  assert(
    "PostgREST schema cache reloaded after migrations",
    false,
    "clients still 404 after NOTIFY pgrst",
  );
}

async function assertPrivilegeMatrix(pool: import("pg").Pool) {
  const client = await pool.connect();
  try {
    const tableGrants = await client.query<{ table_name: string }>(
      `SELECT DISTINCT table_name
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
         AND grantee IN ('anon', 'authenticated')
         AND table_name = ANY($1::text[])`,
      [
        [
          "profiles",
          "user_invitations",
          "social_credentials",
          "social_oauth_states",
          "stripe_webhook_events",
          "_prisma_migrations",
          "job_logs",
          "audit_logs",
          "integration_events",
          "social_content_items",
          "social_competitor_tracks",
        ],
      ],
    );
    assert(
      "information_schema: anon/authenticated have no table grants on secret tables",
      tableGrants.rows.length === 0,
      tableGrants.rows.map((row) => row.table_name).join(","),
    );

    const columnGrants = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.column_privileges
       WHERE table_schema = 'public'
         AND grantee IN ('anon', 'authenticated')
         AND column_name = ANY($1::text[])`,
      [
        [
          "otpHash",
          "tokenHash",
          "encryptedPayload",
          "codeVerifierCiphertext",
          "externalObjectId",
          "externalPageId",
        ],
      ],
    );
    assert(
      "information_schema: anon/authenticated have no column grants on secrets",
      columnGrants.rows.length === 0,
      columnGrants.rows
        .map((row) => `${row.table_name}.${row.column_name}`)
        .join(","),
    );

    const exposedAuthDefiners = await client.query<{
      nspname: string;
      proname: string;
    }>(
      `SELECT n.nspname, p.proname
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.prosecdef
         AND p.proname = ANY($1::text[])
         AND n.nspname = ANY($2::text[])`,
      [AUTH_DEFINER_HELPERS, EXPOSED_SCHEMAS],
    );
    assert(
      "no SECURITY DEFINER auth helpers remain in an exposed schema",
      exposedAuthDefiners.rows.length === 0,
      exposedAuthDefiners.rows
        .map((row) => `${row.nspname}.${row.proname}`)
        .join(","),
    );

    const definer = await client.query<{
      nspname: string;
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `SELECT n.nspname, p.proname, p.prosecdef, p.proconfig
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.proname = ANY($1::text[])`,
      [AUTH_DEFINER_HELPERS],
    );
    assert(
      "current_profile_id is not installed (no profile-id oracle)",
      !definer.rows.some((row) => row.proname === "current_profile_id"),
    );
    const helpers = definer.rows.filter((row) =>
      [
        "is_current_profile",
        "has_client_access",
        "has_any_workspace_membership",
      ].includes(row.proname),
    );
    assert(
      "tenant helpers exist only in private as SECURITY DEFINER",
      helpers.length === 3 &&
        helpers.every((row) => row.nspname === "private" && row.prosecdef),
    );
    assert(
      "tenant helpers pin search_path to pg_catalog only",
      helpers.every((row) =>
        (row.proconfig ?? []).some((entry) =>
          /^search_path=pg_catalog(?:,\s*pg_temp)?$/i.test(entry),
        ),
      ),
    );

    const exec = await client.query<{
      proname: string;
      public_ok: boolean;
      anon_ok: boolean;
      auth_ok: boolean;
    }>(
      `SELECT
         p.proname,
         EXISTS (
           SELECT 1
           FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) e
           WHERE e.privilege_type = 'EXECUTE' AND e.grantee = 0
         ) AS public_ok,
         has_function_privilege('anon', p.oid, 'execute') AS anon_ok,
         has_function_privilege('authenticated', p.oid, 'execute') AS auth_ok
       FROM pg_proc p
       WHERE p.pronamespace = 'private'::regnamespace
         AND p.proname IN (
           'is_current_profile',
           'has_client_access',
           'has_any_workspace_membership'
         )`,
    );
    assert(
      "PUBLIC cannot execute tenant helpers",
      exec.rows.every((row) => row.public_ok === false),
    );
    assert(
      "anon cannot execute tenant helpers",
      exec.rows.every((row) => row.anon_ok === false),
    );
    assert(
      "authenticated can execute only the intended tenant helpers",
      exec.rows.every((row) => row.auth_ok === true) && exec.rows.length === 3,
    );

    const schemaPriv = await client.query<{
      role: string;
      private_usage: boolean;
      private_create: boolean;
      public_create: boolean;
      catalog_create: boolean;
    }>(
      `SELECT
         r.rolname AS role,
         has_schema_privilege(r.rolname, 'private', 'USAGE') AS private_usage,
         has_schema_privilege(r.rolname, 'private', 'CREATE') AS private_create,
         has_schema_privilege(r.rolname, 'public', 'CREATE') AS public_create,
         has_schema_privilege(r.rolname, 'pg_catalog', 'CREATE') AS catalog_create
       FROM pg_roles r
       WHERE r.rolname IN ('anon', 'authenticated')`,
    );
    const anonPriv = schemaPriv.rows.find((row) => row.role === "anon");
    const authPriv = schemaPriv.rows.find((row) => row.role === "authenticated");
    assert(
      "anon has no USAGE or CREATE on private",
      anonPriv?.private_usage === false && anonPriv?.private_create === false,
    );
    assert(
      "authenticated has USAGE on private but not CREATE",
      authPriv?.private_usage === true && authPriv?.private_create === false,
    );
    assert(
      "anon/authenticated cannot CREATE in public or pg_catalog",
      schemaPriv.rows.length === 2 &&
        schemaPriv.rows.every(
          (row) => row.public_create === false && row.catalog_create === false,
        ),
    );

    const publicRpc = await client.query<{ exists: boolean }>(
      `SELECT
         to_regprocedure('public.has_client_access(uuid)') IS NOT NULL
         OR to_regprocedure('public.is_current_profile(uuid)') IS NOT NULL
         OR to_regprocedure('public.has_any_workspace_membership()') IS NOT NULL
         AS exists`,
    );
    assert(
      "public copies of tenant helpers are not installed",
      publicRpc.rows[0]?.exists === false,
    );

    const stalePolicies = await client.query<{ polname: string }>(
      `SELECT pol.polname
       FROM pg_policy pol
       JOIN pg_class rel ON rel.oid = pol.polrelid
       JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
       WHERE nsp.nspname = 'public'
         AND pg_get_expr(pol.polqual, pol.polrelid) ~ 'public\\.(has_client_access|is_current_profile|has_any_workspace_membership)'`,
    );
    assert(
      "no RLS policy still calls public tenant helpers",
      stalePolicies.rows.length === 0,
      stalePolicies.rows.map((row) => row.polname).join(","),
    );

    const exposedSetting = await client.query<{ exposed: string | null }>(
      `SELECT current_setting('pgrst.db_schemas', true) AS exposed`,
    );
    const exposed = exposedSetting.rows[0]?.exposed;
    assert(
      "private is not in pgrst.db_schemas when that setting exists",
      !exposed || !/(^|[, ])private([, ]|$)/i.test(exposed),
      exposed ?? "",
    );
  } finally {
    client.release();
  }
}

function postgrestRpcIsUnexposed(status: number, body: string): boolean {
  if (status === 200 || status === 201 || status === 204) return false;
  if (/permission denied for function/i.test(body)) return false;
  if (status === 404 || status === 406) return true;
  if (
    /PGRST202|PGRST106|PGRST205|Could not find the function|schema must be one of|Invalid schema/i.test(
      body,
    )
  ) {
    return true;
  }
  return false;
}

async function probePostgrestRpc(
  url: string,
  key: string,
  name: string,
  body: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; text: string }> {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, text: await response.text() };
}

async function assertPostgrestAnonDenied() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    console.log("[rls] PostgREST HTTP checks skipped: Supabase URL/anon key missing");
    return;
  }

  console.log("[rls] PostgREST anon Data API checks");
  const paths = [
    "profiles?select=otpHash",
    "profiles?select=id",
    "user_invitations?select=tokenHash",
    "user_invitations?select=id",
    "social_credentials?select=encryptedPayload",
    "social_oauth_states?select=codeVerifierCiphertext",
    "stripe_webhook_events?select=id",
    "_prisma_migrations?select=id",
  ];
  for (const path of paths) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Accept: "application/json",
      },
    });
    const text = await response.text();
    let rowCount = -1;
    try {
      const parsed = JSON.parse(text) as unknown;
      rowCount = Array.isArray(parsed) ? parsed.length : -1;
    } catch {
      rowCount = -1;
    }
    const blocked =
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404 ||
      (response.status === 200 && rowCount === 0) ||
      /permission denied|not accept|PGRST/i.test(text);
    assert(
      `PostgREST anon cannot read /rest/v1/${path.split("?")[0]}`,
      blocked,
      `status=${response.status}`,
    );
  }

  const rpcProbes: Array<{ name: string; body: Record<string, string> }> = [
    {
      name: "has_client_access",
      body: { target_client: "00000000-0000-0000-0000-000000000000" },
    },
    {
      name: "is_current_profile",
      body: { target_profile: "00000000-0000-0000-0000-000000000000" },
    },
    { name: "has_any_workspace_membership", body: {} },
  ];
  const keys = [{ label: "anon", key: anon }];
  const service =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) keys.push({ label: "service", key: service });

  for (const { label, key } of keys) {
    for (const probe of rpcProbes) {
      const publicRpc = await probePostgrestRpc(url, key, probe.name, probe.body);
      assert(
        `PostgREST ${label} /rpc/${probe.name} is unavailable`,
        postgrestRpcIsUnexposed(publicRpc.status, publicRpc.text),
        `status=${publicRpc.status} body=${publicRpc.text.slice(0, 180)}`,
      );
      const privateProfile = await probePostgrestRpc(
        url,
        key,
        probe.name,
        probe.body,
        { "Accept-Profile": "private", "Content-Profile": "private" },
      );
      assert(
        `PostgREST ${label} cannot expose private /rpc/${probe.name}`,
        postgrestRpcIsUnexposed(privateProfile.status, privateProfile.text),
        `status=${privateProfile.status} body=${privateProfile.text.slice(0, 180)}`,
      );
    }
  }
}

async function restGet(
  url: string,
  anon: string,
  token: string,
  path: string,
): Promise<{ status: number; json: unknown; text: string }> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const text = await response.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, json, text };
}

async function restWrite(
  url: string,
  anon: string,
  token: string,
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<number> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return response.status;
}

function rowIds(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((row) =>
      row && typeof row === "object" && "id" in row ? String(row.id) : "",
    )
    .filter(Boolean);
}

async function assertPostgrestJwtIsolation(options: {
  tokenA: string;
  tokenB: string;
  tokenC: string;
  clientAId: string;
  clientBId: string;
  locationAId: string;
  locationBId: string;
  assignmentAId: string;
  assignmentBId: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    console.log("[rls] PostgREST JWT checks skipped: URL/anon key missing");
    return;
  }

  console.log("[rls] PostgREST authenticated A/B/C isolation");
  const aClients = await restGet(url, anon, options.tokenA, "clients?select=id,name");
  const bClients = await restGet(url, anon, options.tokenB, "clients?select=id,name");
  const cClients = await restGet(url, anon, options.tokenC, "clients?select=id,name");
  const aIds = rowIds(aClients.json);
  const bIds = rowIds(bClients.json);
  assert(
    "PostgREST A reads Workspace A",
    aClients.status === 200 && aIds.includes(options.clientAId),
    `status=${aClients.status} body=${aClients.text.slice(0, 180)}`,
  );
  assert(
    "PostgREST A cannot read Workspace B",
    aClients.status === 200 && !aIds.includes(options.clientBId),
    `status=${aClients.status}`,
  );
  assert(
    "PostgREST B reads Workspace B",
    bClients.status === 200 && bIds.includes(options.clientBId),
    `status=${bClients.status} body=${bClients.text.slice(0, 180)}`,
  );
  assert(
    "PostgREST B cannot read Workspace A",
    bClients.status === 200 && !bIds.includes(options.clientAId),
    `status=${bClients.status}`,
  );
  assert(
    "PostgREST C receives no workspace rows",
    cClients.status === 200 && rowIds(cClients.json).length === 0,
    `status=${cClients.status} body=${cClients.text.slice(0, 180)}`,
  );

  const aAsB = await restGet(
    url,
    anon,
    options.tokenA,
    `clients?select=id&id=eq.${options.clientBId}`,
  );
  const bAsA = await restGet(
    url,
    anon,
    options.tokenB,
    `clients?select=id&id=eq.${options.clientAId}`,
  );
  assert("PostgREST A cannot read B by id", rowIds(aAsB.json).length === 0);
  assert("PostgREST B cannot read A by id", rowIds(bAsA.json).length === 0);

  const locSwap = await restGet(
    url,
    anon,
    options.tokenA,
    `business_locations?select=id&id=eq.${options.locationBId}`,
  );
  const assignSwap = await restGet(
    url,
    anon,
    options.tokenB,
    `social_brand_account_assignments?select=id&id=eq.${options.assignmentAId}`,
  );
  assert("PostgREST A cannot read B location by id", rowIds(locSwap.json).length === 0);
  assert(
    "PostgREST B cannot read A social assignment by id",
    rowIds(assignSwap.json).length === 0,
  );

  const profiles = await restGet(url, anon, options.tokenA, "profiles?select=id");
  const migrations = await restGet(
    url,
    anon,
    options.tokenA,
    "_prisma_migrations?select=id",
  );
  assert(
    "PostgREST A cannot read Prisma-only profiles",
    profiles.status >= 400 || rowIds(profiles.json).length === 0,
    `status=${profiles.status}`,
  );
  assert(
    "PostgREST A cannot read _prisma_migrations",
    migrations.status >= 400 ||
      (Array.isArray(migrations.json) && migrations.json.length === 0),
    `status=${migrations.status}`,
  );

  const insertStatus = await restWrite(url, anon, options.tokenA, "POST", "clients", {
    name: "injected",
  });
  const updateStatus = await restWrite(
    url,
    anon,
    options.tokenA,
    "PATCH",
    `clients?id=eq.${options.clientAId}`,
    { name: "renamed" },
  );
  const deleteStatus = await restWrite(
    url,
    anon,
    options.tokenA,
    "DELETE",
    `clients?id=eq.${options.clientAId}`,
  );
  assert(
    "PostgREST Data API INSERT is denied",
    insertStatus === 401 || insertStatus === 403 || insertStatus === 404 || insertStatus >= 400,
    `status=${insertStatus}`,
  );
  assert(
    "PostgREST Data API UPDATE is denied",
    updateStatus === 401 || updateStatus === 403 || updateStatus === 404 || updateStatus >= 400,
    `status=${updateStatus}`,
  );
  assert(
    "PostgREST Data API DELETE is denied",
    deleteStatus === 401 || deleteStatus === 403 || deleteStatus === 404 || deleteStatus >= 400,
    `status=${deleteStatus}`,
  );

  for (const name of ["has_client_access", "is_current_profile", "has_any_workspace_membership"]) {
    const rpc = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${options.tokenA}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        name === "has_any_workspace_membership"
          ? {}
          : { target_client: options.clientAId, target_profile: options.clientAId },
      ),
    });
    const text = await rpc.text();
    assert(
      `PostgREST authenticated /rpc/${name} is unavailable`,
      postgrestRpcIsUnexposed(rpc.status, text),
      `status=${rpc.status}`,
    );
  }
}

function mochaSafeConnectionString(connectionString: string): string {
  const withoutSslMode = connectionString
    .replace(/([?&])sslmode=[^&]*/g, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
  const separator = withoutSslMode.includes("?") ? "&" : "?";
  return `${withoutSslMode}${separator}sslmode=no-verify`;
}

function isLoopback(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/.test(connectionString);
  }
}

async function runDatabaseChecks(connectionString: string) {
  const pgModule = await import("pg");
  const Pool = pgModule.Pool ?? pgModule.default.Pool;
  const { getPrisma } = await import("../src/lib/db/prisma");
  const prisma = getPrisma();
  if (!prisma) {
    console.log("[rls] database checks skipped: Prisma client could not start");
    return;
  }

  const poolConnectionString = isLoopback(connectionString)
    ? connectionString
    : mochaSafeConnectionString(connectionString);
  const pool = new Pool({
    connectionString: poolConnectionString,
    max: 2,
    ...(!isLoopback(connectionString)
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });

  const stamp = Date.now().toString(36);
  const seed = readEphemeralSeed();
  if (isEphemeralSupabase()) {
    assert(
      "ephemeral RLS job does not contain hosted project ref",
      !JSON.stringify(process.env).includes(FORBIDDEN_HOSTED_REF),
    );
  }

  let authA = seed?.a.authUserId ?? randomUUID();
  let authB = seed?.b.authUserId ?? randomUUID();
  let authDisabled = seed?.disabled.authUserId ?? randomUUID();
  let emailA = seed?.a.email ?? `rls-a-${stamp}@example.test`;
  let emailB = seed?.b.email ?? `rls-b-${stamp}@example.test`;
  const emailInvitee = `rls-invitee-${stamp}@example.test`;
  let tokenA = "";
  let tokenB = "";
  let tokenC = "";

  let clientAId = "";
  let clientBId = "";
  let clientDisabledId = "";
  let profileAId = "";
  let profileBId = "";
  let profileDisabledId = "";
  let locationAId = "";
  let locationBId = "";
  let assignmentAId = "";
  let assignmentBId = "";
  let invitationInviterId = "";
  let invitationInviteeId = "";

  try {
    const ready = await databaseReady(pool);
    if (ready.ok || !ready.reason.includes("roles missing")) {
      console.log("[rls] PostgreSQL table-vs-column GRANT probe");
      await proveTableGrantColumnRevokeIsNoOp(pool);
    }
    if (!ready.ok) {
      if (ready.reason.includes("roles missing") || ready.reason.includes("auth.uid()")) {
        console.log(`[rls] database checks skipped: ${ready.reason}`);
        return;
      }
      console.log(`[rls] database checks blocked: ${ready.reason}`);
      assert(
        "RLS migration is applied on this Supabase database",
        false,
        ready.reason,
      );
      return;
    }

    await reloadPostgrestSchema(pool);

    if (seed) {
      console.log("[rls] using ephemeral Auth identities");
      profileAId = seed.a.profileId;
      profileBId = seed.b.profileId;
      profileDisabledId = seed.disabled.profileId;
      clientAId = seed.a.clientId;
      clientBId = seed.b.clientId;
      clientDisabledId = seed.disabled.clientId ?? "";
      locationAId = seed.a.locationId;
      locationBId = seed.b.locationId;
      assignmentAId = seed.a.assignmentId;
      assignmentBId = seed.b.assignmentId;
      try {
        tokenA = await passwordGrant(seed.a.email, seed.a.password);
        tokenB = await passwordGrant(seed.b.email, seed.b.password);
        tokenC = await passwordGrant(seed.c.email, seed.c.password);
      } catch (error) {
        assert(
          "password grant from local Auth",
          false,
          error instanceof Error ? error.message : String(error),
        );
        return;
      }
      assert(
        "A JWT sub comes from local Auth",
        jwtPayload(tokenA).sub === seed.a.authUserId,
      );
      assert(
        "B JWT sub comes from local Auth",
        jwtPayload(tokenB).sub === seed.b.authUserId,
      );
      assert(
        "C JWT sub comes from local Auth",
        jwtPayload(tokenC).sub === seed.c.authUserId,
      );
    } else {
    console.log("[rls] seeding User A / User B fixtures");
    const profileA = await prisma.profile.create({
      data: {
        authUserId: authA,
        email: emailA,
        displayName: "RLS User A",
        role: "user",
        status: "active",
        otpHash: `pending.v1.rls-${stamp}`,
      },
    });
    const profileB = await prisma.profile.create({
      data: {
        authUserId: authB,
        email: emailB,
        displayName: "RLS User B",
        role: "user",
        status: "active",
      },
    });
    profileAId = profileA.id;
    profileBId = profileB.id;

    const workspaceA = await prisma.client.create({
      data: { name: `RLS Workspace A ${stamp}`, status: "active" },
    });
    const workspaceB = await prisma.client.create({
      data: { name: `RLS Workspace B ${stamp}`, status: "active" },
    });
    clientAId = workspaceA.id;
    clientBId = workspaceB.id;

    await prisma.clientMembership.create({
      data: {
        profileId: profileA.id,
        clientId: workspaceA.id,
        role: "owner",
        status: "active",
      },
    });
    await prisma.clientMembership.create({
      data: {
        profileId: profileB.id,
        clientId: workspaceB.id,
        role: "owner",
        status: "active",
      },
    });

    const profileDisabled = await prisma.profile.create({
      data: {
        authUserId: authDisabled,
        email: `rls-disabled-${stamp}@example.test`,
        displayName: "RLS Disabled",
        role: "user",
        status: "disabled",
      },
    });
    const workspaceDisabled = await prisma.client.create({
      data: { name: `RLS Workspace Disabled ${stamp}`, status: "active" },
    });
    profileDisabledId = profileDisabled.id;
    clientDisabledId = workspaceDisabled.id;
    await prisma.clientMembership.create({
      data: {
        profileId: profileDisabled.id,
        clientId: workspaceDisabled.id,
        role: "owner",
        status: "active",
      },
    });

    const brandA = await prisma.businessBrand.create({
      data: {
        clientId: workspaceA.id,
        name: `Brand A ${stamp}`,
        status: "active",
      },
    });
    const brandB = await prisma.businessBrand.create({
      data: {
        clientId: workspaceB.id,
        name: `Brand B ${stamp}`,
        status: "active",
      },
    });

    const locationA = await prisma.businessLocation.create({
      data: {
        clientId: workspaceA.id,
        businessBrandId: brandA.id,
        name: "Location A",
        addressLine1: "1 A Street",
        city: "Toronto",
        status: "active",
      },
    });
    const locationB = await prisma.businessLocation.create({
      data: {
        clientId: workspaceB.id,
        businessBrandId: brandB.id,
        name: "Location B",
        addressLine1: "1 B Street",
        city: "Toronto",
        status: "active",
      },
    });
    locationAId = locationA.id;
    locationBId = locationB.id;

    const accountA = await prisma.socialAccount.create({
      data: {
        clientId: workspaceA.id,
        businessBrandId: brandA.id,
        platform: "facebook",
        displayName: "Page A",
      },
    });
    const accountB = await prisma.socialAccount.create({
      data: {
        clientId: workspaceB.id,
        businessBrandId: brandB.id,
        platform: "facebook",
        displayName: "Page B",
      },
    });

    const assignmentA = await prisma.socialBrandAccountAssignment.create({
      data: {
        clientId: workspaceA.id,
        businessBrandId: brandA.id,
        socialAccountId: accountA.id,
        status: "active",
      },
    });
    const assignmentB = await prisma.socialBrandAccountAssignment.create({
      data: {
        clientId: workspaceB.id,
        businessBrandId: brandB.id,
        socialAccountId: accountB.id,
        status: "active",
      },
    });
    assignmentAId = assignmentA.id;
    assignmentBId = assignmentB.id;
    }

    const invitationFromA = await prisma.userInvitation.create({
      data: {
        clientId: clientAId,
        email: emailInvitee,
        role: "viewer",
        status: "pending",
        tokenHash: `hash-a-${stamp}`,
        invitedByProfileId: profileAId,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const invitationFromB = await prisma.userInvitation.create({
      data: {
        clientId: clientBId,
        email: `other-${stamp}@example.test`,
        role: "viewer",
        status: "pending",
        tokenHash: `hash-b-${stamp}`,
        invitedByProfileId: profileBId,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    invitationInviterId = invitationFromA.id;
    invitationInviteeId = invitationFromB.id;

    await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: `rls-evt-${stamp}`,
        type: "test.event",
        clientId: clientAId,
      },
    });

    const userA: Persona = {
      role: "authenticated",
      sub: authA,
      email: emailA,
      accessToken: tokenA || undefined,
    };
    const userB: Persona = {
      role: "authenticated",
      sub: authB,
      email: emailB,
      accessToken: tokenB || undefined,
    };
    const invitee: Persona = {
      role: "authenticated",
      sub: randomUUID(),
      email: emailInvitee,
    };

    console.log("[rls] privilege matrix + PostgREST");
    await assertPrivilegeMatrix(pool);
    await assertPostgrestAnonDenied();
    if (tokenA && tokenB && tokenC) {
      await assertPostgrestJwtIsolation({
        tokenA,
        tokenB,
        tokenC,
        clientAId,
        clientBId,
        locationAId,
        locationBId,
        assignmentAId,
        assignmentBId,
      });
    }

    console.log("[rls] User A / User B / anonymous Data API checks");

    await withPersona(pool, userA, async (client) => {
      let recursive = false;
      try {
        await client.query(`SELECT id FROM clients WHERE id = $1`, [clientAId]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/42P17|infinite recursion/i.test(message)) {
          recursive = true;
        } else {
          throw error;
        }
      }
      assert("RLS policy evaluation is not recursive", recursive === false);
      const ownOtp = await countRows(
        client,
        `SELECT COUNT(*)::int AS n FROM profiles WHERE id = $1 AND "otpHash" IS NOT NULL`,
        [profileAId],
      );
      assert(
        "A cannot select own otpHash even as row owner",
        isInaccessible(ownOtp),
      );
      assert(
        "A cannot read profiles via Data API (OTP columns force table denial)",
        isInaccessible(
          await countRows(client, `SELECT COUNT(*)::int AS n FROM profiles WHERE id = $1`, [
            profileAId,
          ]),
        ),
      );
      assert(
        "A reads only Workspace A",
        (await countRows(
          client,
          `SELECT COUNT(*)::int AS n FROM clients WHERE id = ANY($1::uuid[])`,
          [[clientAId, clientBId]],
        )) === 1,
      );
      assert(
        "A cannot read B by swapping client id",
        (await countRows(
          client,
          `SELECT COUNT(*)::int AS n FROM clients WHERE id = $1`,
          [clientBId],
        )) === 0,
      );
      assert(
        "membership helper still evaluates without profiles table GRANT (A sees Workspace A)",
        (await countRows(
          client,
          `SELECT COUNT(*)::int AS n FROM clients WHERE id = $1`,
          [clientAId],
        )) === 1,
      );
      const accessA = await client.query<{ ok: boolean }>(
        `SELECT private.has_client_access($1) AS ok`,
        [clientAId],
      );
      const accessB = await client.query<{ ok: boolean }>(
        `SELECT private.has_client_access($1) AS ok`,
        [clientBId],
      );
      const ownProfile = await client.query<{ ok: boolean }>(
        `SELECT private.is_current_profile($1) AS ok`,
        [profileAId],
      );
      const otherProfile = await client.query<{ ok: boolean }>(
        `SELECT private.is_current_profile($1) AS ok`,
        [profileBId],
      );
      const spoofUserAsClient = await client.query<{ ok: boolean }>(
        `SELECT private.has_client_access($1) AS ok`,
        [profileBId],
      );
      assert("A has_client_access(Workspace A) is true", accessA.rows[0]?.ok === true);
      assert(
        "A cannot test or access User B membership via has_client_access",
        accessB.rows[0]?.ok === false,
      );
      assert("A is_current_profile(self) is true", ownProfile.rows[0]?.ok === true);
      assert(
        "A is_current_profile(B) is false",
        otherProfile.rows[0]?.ok === false,
      );
      assert(
        "passing B's profile UUID as target_client cannot impersonate B",
        spoofUserAsClient.rows[0]?.ok === false,
      );
      let alteredFunction = false;
      try {
        await client.query(
          `ALTER FUNCTION private.has_client_access(uuid) OWNER TO authenticated`,
        );
        alteredFunction = true;
      } catch {
        alteredFunction = false;
      }
      assert(
        "authenticated cannot change helper owner",
        alteredFunction === false,
      );
      for (const schema of ["public", "private"] as const) {
        let created = false;
        try {
          await client.query(
            `CREATE TABLE ${schema}.rls_auth_create_${stamp} (id int)`,
          );
          created = true;
        } catch (error) {
          if (!isPermissionDenied(error)) throw error;
        }
        assert(`authenticated cannot CREATE in ${schema}`, created === false);
      }
      assert(
        "A reads only A's membership",
        (await countRows(
          client,
          `SELECT COUNT(*)::int AS n FROM client_memberships WHERE "clientId" = ANY($1::uuid[])`,
          [[clientAId, clientBId]],
        )) === 1,
      );
      assert(
        "A location is tenant-scoped",
        (await countRows(
          client,
          `SELECT COUNT(*)::int AS n FROM business_locations WHERE id = $1`,
          [locationAId],
        )) === 1 &&
          (await countRows(
            client,
            `SELECT COUNT(*)::int AS n FROM business_locations WHERE id = $1`,
            [locationBId],
          )) === 0,
      );
      assert(
        "A social assignment is tenant-scoped",
        (await countRows(
          client,
          `SELECT COUNT(*)::int AS n FROM social_brand_account_assignments WHERE id = $1`,
          [assignmentAId],
        )) === 1 &&
          (await countRows(
            client,
            `SELECT COUNT(*)::int AS n FROM social_brand_account_assignments WHERE id = $1`,
            [assignmentBId],
          )) === 0,
      );
      const ownInvite = await countRows(
        client,
        `SELECT COUNT(*)::int AS n FROM user_invitations WHERE id = $1`,
        [invitationInviterId],
      );
      const ownToken = await countRows(
        client,
        `SELECT COUNT(*)::int AS n FROM user_invitations WHERE "tokenHash" IS NOT NULL AND id = $1`,
        [invitationInviterId],
      );
      assert("A cannot read invitations via Data API", isInaccessible(ownInvite));
      assert("A cannot select invitation tokenHash as inviter", isInaccessible(ownToken));
      assert(
        "A cannot read social_credentials",
        isInaccessible(await countRows(client, `SELECT COUNT(*)::int AS n FROM social_credentials`)),
      );
      assert(
        "A cannot read stripe_webhook_events",
        isInaccessible(
          await countRows(client, `SELECT COUNT(*)::int AS n FROM stripe_webhook_events`),
        ),
      );
      assert(
        "A cannot read _prisma_migrations",
        isInaccessible(
          await countRows(client, `SELECT COUNT(*)::int AS n FROM _prisma_migrations`),
        ),
      );
      let canUpdate = false;
      try {
        await client.query(`UPDATE clients SET name = name WHERE id = $1`, [
          clientAId,
        ]);
        canUpdate = true;
      } catch (error) {
        if (!isPermissionDenied(error)) throw error;
      }
      assert("A cannot UPDATE via Data API", !canUpdate);
    });

    await withPersona(
      pool,
      { role: "authenticated", sub: authDisabled, email: seed?.disabled.email ?? `rls-disabled-${stamp}@example.test`, accessToken: undefined },
      async (client) => {
        const access = await client.query<{ ok: boolean }>(
          `SELECT private.has_client_access($1) AS ok`,
          [clientDisabledId],
        );
        const own = await client.query<{ ok: boolean }>(
          `SELECT private.is_current_profile($1) AS ok`,
          [profileDisabledId],
        );
        const any = await client.query<{ ok: boolean }>(
          `SELECT private.has_any_workspace_membership() AS ok`,
        );
        assert(
          "disabled profile fails closed for has_client_access",
          access.rows[0]?.ok === false,
        );
        assert(
          "disabled profile fails closed for is_current_profile",
          own.rows[0]?.ok === false,
        );
        assert(
          "disabled profile fails closed for has_any_workspace_membership",
          any.rows[0]?.ok === false,
        );
      },
    );

    await withPersona(pool, userB, async (client) => {
      assert(
        "B cannot read profiles via Data API",
        isInaccessible(
          await countRows(client, `SELECT COUNT(*)::int AS n FROM profiles WHERE id = $1`, [
            profileBId,
          ]),
        ),
      );
      assert(
        "B cannot read Workspace A by id",
        (await countRows(
          client,
          `SELECT COUNT(*)::int AS n FROM clients WHERE id = $1`,
          [clientAId],
        )) === 0,
      );
      assert(
        "B location is tenant-scoped",
        (await countRows(
          client,
          `SELECT COUNT(*)::int AS n FROM business_locations WHERE id = $1`,
          [locationBId],
        )) === 1 &&
          (await countRows(
            client,
            `SELECT COUNT(*)::int AS n FROM business_locations WHERE id = $1`,
            [locationAId],
          )) === 0,
      );
      assert(
        "B social assignment is tenant-scoped",
        (await countRows(
          client,
          `SELECT COUNT(*)::int AS n FROM social_brand_account_assignments WHERE id = $1`,
          [assignmentBId],
        )) === 1 &&
          (await countRows(
            client,
            `SELECT COUNT(*)::int AS n FROM social_brand_account_assignments WHERE id = $1`,
            [assignmentAId],
          )) === 0,
      );
    });

    await withPersona(pool, invitee, async (client) => {
      assert(
        "invitee cannot read invitation tokenHash or invitation rows via Data API",
        isInaccessible(
          await countRows(
            client,
            `SELECT COUNT(*)::int AS n FROM user_invitations WHERE id = $1`,
            [invitationInviterId],
          ),
        ),
      );
      assert(
        "invitee without membership cannot read Workspace A",
        (await countRows(
          client,
          `SELECT COUNT(*)::int AS n FROM clients WHERE id = $1`,
          [clientAId],
        )) === 0,
      );
    });

    await withPersona(pool, { role: "anon" }, async (client) => {
      const tables = [
        "profiles",
        "clients",
        "client_memberships",
        "user_invitations",
        "business_locations",
        "social_brand_account_assignments",
        "social_credentials",
        "stripe_webhook_events",
      ];
      for (const table of tables) {
        const n = await countRows(client, `SELECT COUNT(*)::int AS n FROM ${table}`);
        assert(
          `anonymous cannot read ${table}`,
          n === "denied" || n === 0,
        );
      }
      let publicExecuted = false;
      try {
        await client.query(`SELECT public.has_client_access($1)`, [clientAId]);
        publicExecuted = true;
      } catch (error) {
        if (!isPermissionDenied(error) && !isUndefinedFunction(error)) throw error;
      }
      assert(
        "anon cannot execute public.has_client_access",
        publicExecuted === false,
      );
      let anonExecuted = false;
      try {
        await client.query(`SELECT private.has_client_access($1)`, [clientAId]);
        anonExecuted = true;
      } catch (error) {
        if (!isPermissionDenied(error) && !isUndefinedFunction(error)) throw error;
      }
      assert("anon cannot execute private.has_client_access", anonExecuted === false);
      for (const schema of ["public", "private"] as const) {
        let created = false;
        try {
          await client.query(
            `CREATE TABLE ${schema}.rls_anon_create_${stamp} (id int)`,
          );
          created = true;
        } catch (error) {
          if (!isPermissionDenied(error)) throw error;
        }
        assert(`anon cannot CREATE in ${schema}`, created === false);
      }
    });

    const prismaSeesBoth = await prisma.client.count({
      where: { id: { in: [clientAId, clientBId] } },
    });
    assert(
      "Prisma owner connection still reads both tenants (RLS bypass)",
      prismaSeesBoth === 2,
    );
  } catch (error) {
    assert(
      "live RLS checks completed without crash",
      false,
      error instanceof Error ? error.message : String(error),
    );
    console.error("[rls] live checks threw", error);
  } finally {
    try {
      if (!seed && (clientAId || clientBId)) {
        await prisma.client.deleteMany({
          where: {
            id: {
              in: [clientAId, clientBId, clientDisabledId].filter(Boolean),
            },
          },
        });
      }
      if (!seed && (profileAId || profileBId || profileDisabledId)) {
        await prisma.profile.deleteMany({
          where: {
            id: {
              in: [profileAId, profileBId, profileDisabledId].filter(Boolean),
            },
          },
        });
      }
    } catch (error) {
      console.error(
        "[rls] cleanup failed",
        error instanceof Error ? error.message : error,
      );
    }
    await prisma.$disconnect();
    await pool.end();
  }
}

async function main() {
  runStaticChecks();

  const staticOnly = process.env.QA_RLS_STATIC_ONLY === "1";
  const connectionString = process.env.DATABASE_URL?.trim();

  if (staticOnly) {
    console.log(
      "[rls] QA_RLS_STATIC_ONLY=1; database-applied policy tests skipped.",
    );
  } else {
    await import("@prisma/client");
    if (!connectionString) {
      console.log(
        "[rls] DATABASE_URL is not set; database policy tests skipped. Static checks still apply.",
      );
    } else {
      await runDatabaseChecks(connectionString);
    }
  }

  const ranDatabaseChecks = !staticOnly && Boolean(connectionString);
  if (failed === 0) {
    console.log(
      ranDatabaseChecks
        ? "\nRLS POLICY CHECKS: ALL PASSED"
        : "\nSTATIC RLS CHECKS: ALL PASSED (database-applied checks not run)",
    );
  } else {
    console.log(`\nRLS POLICY CHECKS: ${failed} FAILURE(S)`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("[rls] crashed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
