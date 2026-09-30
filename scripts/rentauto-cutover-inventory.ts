import { createClient } from "@supabase/supabase-js";

const SOURCE_TABLES = [
  "profiles",
  "user_roles",
  "cars",
  "car_photos",
  "car_extras",
  "car_policies",
  "trips",
  "availability_blocks",
  "favorites",
  "reviews",
  "host_verifications",
  "host_preferences",
  "stripe_accounts",
  "vehicle_tracking_devices",
  "trip_tracking_sessions",
  "vehicle_location_events",
  "trip_events",
  "trip_incidents",
  "notifications",
  "support_tickets",
  "concierge_threads",
  "concierge_messages",
  "travel_itineraries",
] as const;

const TARGET_TABLES = [
  "accounts",
  "account_roles",
  "cars",
  "car_photos",
  "car_extras",
  "car_policies",
  "trips",
  "availability_blocks",
  "booking_holds",
  "favorites",
  "reviews",
  "host_applications",
  "host_verifications",
  "host_preferences",
  "stripe_accounts",
  "vehicle_tracking_devices",
  "trip_tracking_sessions",
  "vehicle_location_events",
  "trip_events",
  "trip_incidents",
  "notifications",
  "support_tickets",
  "concierge_threads",
  "concierge_messages",
  "travel_itineraries",
] as const;

type CountResult = {
  table: string;
  count: number | null;
  error: string | null;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

async function countTable(
  client: ReturnType<typeof createClient>,
  table: string,
): Promise<CountResult> {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });

  return {
    table,
    count: error ? null : count ?? 0,
    error: error ? `${error.code ?? "query_error"}: ${error.message}` : null,
  };
}

async function countAuthUsers(
  client: ReturnType<typeof createClient>,
): Promise<number> {
  let total = 0;
  let page = 1;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`Auth inventory failed: ${error.message}`);
    }

    const size = data.users.length;
    total += size;
    if (size < 1000) return total;
    page += 1;
  }
}

async function main() {
  const sourceUrl = required("RENTAUTO_LEGACY_SUPABASE_URL");
  const sourceServiceKey = required(
    "RENTAUTO_LEGACY_SUPABASE_SERVICE_ROLE_KEY",
  );
  const targetUrl =
    process.env.TAKATAK_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    required("NEXT_PUBLIC_SUPABASE_URL");
  const targetServiceKey =
    process.env.TAKATAK_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    "";

  if (!targetServiceKey) {
    throw new Error(
      "Missing TAKATAK_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY",
    );
  }

  if (hostOf(sourceUrl) === hostOf(targetUrl)) {
    throw new Error(
      "Legacy Rentauto and TAKATAK target resolve to the same Supabase host. Refusing inventory because a cutover comparison needs distinct projects.",
    );
  }

  const source = createClient(sourceUrl, sourceServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const targetRoot = createClient(targetUrl, targetServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const target = targetRoot.schema("rentauto");

  const [sourceAuthUsers, targetAuthUsers, sourceCounts, targetCounts] =
    await Promise.all([
      countAuthUsers(source),
      countAuthUsers(targetRoot),
      Promise.all(SOURCE_TABLES.map((table) => countTable(source, table))),
      Promise.all(TARGET_TABLES.map((table) => countTable(target, table))),
    ]);

  const sourceFailures = sourceCounts.filter((row) => row.error);
  const targetFailures = targetCounts.filter((row) => row.error);

  const sourceByTable = Object.fromEntries(
    sourceCounts.map((row) => [row.table, row.count]),
  );
  const targetByTable = Object.fromEntries(
    targetCounts.map((row) => [row.table, row.count]),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "READ_ONLY_INVENTORY",
    source: {
      host: hostOf(sourceUrl),
      authUsers: sourceAuthUsers,
      tables: sourceByTable,
      queryFailures: sourceFailures,
    },
    target: {
      host: hostOf(targetUrl),
      authUsers: targetAuthUsers,
      schema: "rentauto",
      tables: targetByTable,
      queryFailures: targetFailures,
    },
    gates: {
      distinctProjects: hostOf(sourceUrl) !== hostOf(targetUrl),
      sourceReadable: sourceFailures.length === 0,
      targetReadable: targetFailures.length === 0,
      legacyUsersDetected: sourceAuthUsers > 0,
      legacyVehiclesDetected: (sourceByTable.cars ?? 0) > 0,
      legacyTripsDetected: (sourceByTable.trips ?? 0) > 0,
      productionCutoverApproved: false,
    },
    nextAction:
      sourceFailures.length || targetFailures.length
        ? "Fix inventory access/schema mismatches before any migration."
        : "Inventory readable. Run identity mapping and staged data migration; do not approve production cutover yet.",
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (sourceFailures.length || targetFailures.length) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(
    "[rentauto-cutover-inventory]",
    error instanceof Error ? error.message : "unknown_error",
  );
  process.exit(1);
});
