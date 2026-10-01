import "server-only";

import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { getPrisma } from "@/lib/db/prisma";
import { getPlatformAdminAccess } from "@/lib/security/platform-admin-access";

export type RentautoAdminData = {
  available: boolean;
  sourceLabel: string;
  customers: number;
  projectedCustomers: number;
  verifiedEmailProfiles: number;
  verifiedPhoneProfiles: number;
  paymentSummaries: number;
  paidAmountMinor: number;
  refundedAmountMinor: number;
  currency: string;
  lastSynchronizedAt: string | null;
  settlements: {
    policyConfigured: boolean;
    payoutsEnabled: boolean;
    platformFeeBps: number | null;
    disputeWindowHours: number | null;
    eligibleCount: number;
    eligibleAmountMinor: number;
    heldCount: number;
    heldAmountMinor: number;
    blockedCount: number;
    transferredCount: number;
    transferredNetMinor: number;
    reversalRequiredCount: number;
    refundedAmountMinor: number;
  };
  operations: {
    hosts: number;
    pendingHostApplications: number;
    approvedHostApplications: number;
    vehicles: number;
    activeVehicles: number;
    pendingVehicleReviews: number;
    pendingDriverVerifications: number;
    trips: number;
    activeTrips: number;
    completedTrips: number;
    grossBookingValueMinor: number;
    openSupportTickets: number;
    openIncidents: number;
  };
  recentEvents: Array<{
    id: string;
    eventType: string;
    status: string;
    createdAt: string;
    processedAt: string | null;
  }>;
};

const emptySettlements = (): RentautoAdminData["settlements"] => ({
  policyConfigured: false,
  payoutsEnabled: false,
  platformFeeBps: null,
  disputeWindowHours: null,
  eligibleCount: 0,
  eligibleAmountMinor: 0,
  heldCount: 0,
  heldAmountMinor: 0,
  blockedCount: 0,
  transferredCount: 0,
  transferredNetMinor: 0,
  reversalRequiredCount: 0,
  refundedAmountMinor: 0,
});

const emptyOperations = (): RentautoAdminData["operations"] => ({
  hosts: 0,
  pendingHostApplications: 0,
  approvedHostApplications: 0,
  vehicles: 0,
  activeVehicles: 0,
  pendingVehicleReviews: 0,
  pendingDriverVerifications: 0,
  trips: 0,
  activeTrips: 0,
  completedTrips: 0,
  grossBookingValueMinor: 0,
  openSupportTickets: 0,
  openIncidents: 0,
});

const emptyData = (sourceLabel: string): RentautoAdminData => ({
  available: false,
  sourceLabel,
  customers: 0,
  projectedCustomers: 0,
  verifiedEmailProfiles: 0,
  verifiedPhoneProfiles: 0,
  paymentSummaries: 0,
  paidAmountMinor: 0,
  refundedAmountMinor: 0,
  currency: "CAD",
  lastSynchronizedAt: null,
  settlements: emptySettlements(),
  operations: emptyOperations(),
  recentEvents: [],
});

async function getOperationalData() {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const db = admin.schema("rentauto");
  const [
    accounts,
    hosts,
    pendingHosts,
    approvedHosts,
    vehicles,
    activeVehicles,
    pendingVehicleReviews,
    pendingDriverVerifications,
    trips,
    activeTrips,
    completedTrips,
    paidTrips,
    openSupport,
    openIncidents,
    settlementPolicyResult,
    settlementsResult,
  ] = await Promise.all([
    db.from("accounts").select("auth_user_id", { count: "exact", head: true }),
    db
      .from("account_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "host"),
    db
      .from("host_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    db
      .from("host_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    db.from("cars").select("id", { count: "exact", head: true }),
    db
      .from("cars")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    db
      .from("cars")
      .select("id", { count: "exact", head: true })
      .eq("insurance_status", "pending"),
    db
      .from("driver_verifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    db.from("trips").select("id", { count: "exact", head: true }),
    db
      .from("trips")
      .select("id", { count: "exact", head: true })
      .in("status", ["check_in_pending", "active", "check_out_pending"]),
    db
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    db
      .from("trips")
      .select("total_cents,currency")
      .eq("payment_status", "paid"),
    db
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .not("status", "in", '("resolved","closed")'),
    db
      .from("trip_incidents")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    db
      .from("settlement_policy")
      .select("payouts_enabled,platform_fee_bps,dispute_window_hours")
      .eq("id", 1)
      .maybeSingle(),
    db
      .from("trip_settlements")
      .select(
        "status,host_amount_cents,reversed_amount_cents,refunded_cents,currency,stripe_transfer_id",
      ),
  ]);

  const grossBookingValueMinor = (paidTrips.data ?? []).reduce(
    (total, trip) =>
      total +
      (typeof trip.total_cents === "number" ? Math.max(0, trip.total_cents) : 0),
    0,
  );

  const settlementRows = settlementsResult.data ?? [];
  const settlementPolicy = settlementPolicyResult.data;
  const policyConfigured = Boolean(
    settlementPolicy &&
      typeof settlementPolicy.platform_fee_bps === "number" &&
      typeof settlementPolicy.dispute_window_hours === "number",
  );

  const eligibleRows = settlementRows.filter((row) => row.status === "eligible");
  const heldRows = settlementRows.filter(
    (row) =>
      !row.stripe_transfer_id &&
      ["configuration_required", "pending_trip", "hold", "blocked", "failed"].includes(
        String(row.status),
      ),
  );
  const transferredRows = settlementRows.filter((row) =>
    Boolean(row.stripe_transfer_id),
  );

  const settlements = {
    policyConfigured,
    payoutsEnabled: Boolean(settlementPolicy?.payouts_enabled && policyConfigured),
    platformFeeBps:
      typeof settlementPolicy?.platform_fee_bps === "number"
        ? settlementPolicy.platform_fee_bps
        : null,
    disputeWindowHours:
      typeof settlementPolicy?.dispute_window_hours === "number"
        ? settlementPolicy.dispute_window_hours
        : null,
    eligibleCount: eligibleRows.length,
    eligibleAmountMinor: eligibleRows.reduce(
      (total, row) => total + Math.max(0, row.host_amount_cents ?? 0),
      0,
    ),
    heldCount: heldRows.length,
    heldAmountMinor: heldRows.reduce(
      (total, row) => total + Math.max(0, row.host_amount_cents ?? 0),
      0,
    ),
    blockedCount: settlementRows.filter((row) => row.status === "blocked").length,
    transferredCount: transferredRows.length,
    transferredNetMinor: transferredRows.reduce(
      (total, row) =>
        total +
        Math.max(
          0,
          (row.host_amount_cents ?? 0) - (row.reversed_amount_cents ?? 0),
        ),
      0,
    ),
    reversalRequiredCount: settlementRows.filter(
      (row) => row.status === "reversal_required",
    ).length,
    refundedAmountMinor: settlementRows.reduce(
      (total, row) => total + Math.max(0, row.refunded_cents ?? 0),
      0,
    ),
  };

  const currency =
    settlementRows.find(
      (row) => typeof row.currency === "string" && row.currency,
    )?.currency ??
    (paidTrips.data ?? []).find(
      (trip) => typeof trip.currency === "string" && trip.currency,
    )?.currency ??
    "CAD";

  return {
    customers: accounts.count ?? 0,
    currency: String(currency).toUpperCase(),
    settlements,
    operations: {
      hosts: hosts.count ?? 0,
      pendingHostApplications: pendingHosts.count ?? 0,
      approvedHostApplications: approvedHosts.count ?? 0,
      vehicles: vehicles.count ?? 0,
      activeVehicles: activeVehicles.count ?? 0,
      pendingVehicleReviews: pendingVehicleReviews.count ?? 0,
      pendingDriverVerifications: pendingDriverVerifications.count ?? 0,
      trips: trips.count ?? 0,
      activeTrips: activeTrips.count ?? 0,
      completedTrips: completedTrips.count ?? 0,
      grossBookingValueMinor,
      openSupportTickets: openSupport.count ?? 0,
      openIncidents: openIncidents.count ?? 0,
    },
  };
}

export async function getRentautoAdminData(): Promise<RentautoAdminData> {
  const access = await getPlatformAdminAccess();

  if (access.mode !== "authorized") {
    return emptyData("Platform administration access is required.");
  }

  const prisma = getPrisma();
  if (!prisma) {
    return emptyData("TAKATAK database is unavailable.");
  }

  try {
    const [operational, profiles, payments, recentEvents] = await Promise.all([
      getOperationalData(),
      prisma.sourceProfile.findMany({
        where: { sourceApplication: "RENTAUTO" },
        select: {
          id: true,
          verifiedFields: true,
          lastSynchronizedAt: true,
        },
      }),
      prisma.sourcePaymentSummary.findMany({
        where: { sourceApplication: "RENTAUTO" },
        select: {
          status: true,
          amountMinor: true,
          refundedAmountMinor: true,
          currency: true,
          transactionDate: true,
        },
      }),
      prisma.sourceSynchronizationEvent.findMany({
        where: { sourceApplication: "RENTAUTO" },
        select: {
          id: true,
          eventType: true,
          status: true,
          createdAt: true,
          processedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

    const verifiedEmailProfiles = profiles.filter((profile) =>
      profile.verifiedFields.includes("email"),
    ).length;

    const verifiedPhoneProfiles = profiles.filter((profile) =>
      profile.verifiedFields.includes("phone"),
    ).length;

    const paid = payments.filter(
      (payment) =>
        payment.status === "PAID" ||
        payment.status === "PARTIALLY_REFUNDED" ||
        payment.status === "REFUNDED",
    );

    const paidAmountMinor = paid.reduce(
      (total, payment) => total + Math.max(0, payment.amountMinor),
      0,
    );

    const refundedAmountMinor = paid.reduce(
      (total, payment) =>
        total + Math.max(0, payment.refundedAmountMinor ?? 0),
      0,
    );

    const latestProfileSync = profiles.reduce<Date | null>(
      (latest, profile) =>
        !latest || profile.lastSynchronizedAt > latest
          ? profile.lastSynchronizedAt
          : latest,
      null,
    );

    const latestPaymentSync = payments.reduce<Date | null>(
      (latest, payment) =>
        !latest || payment.transactionDate > latest
          ? payment.transactionDate
          : latest,
      null,
    );

    const latestEvent = recentEvents[0]?.createdAt ?? null;
    const lastSynchronized =
      [latestProfileSync, latestPaymentSync, latestEvent]
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const projectionCurrency =
      payments.find((payment) => payment.currency)?.currency?.toUpperCase() ??
      null;

    return {
      available: Boolean(operational),
      sourceLabel: operational
        ? "Live Rentauto operational data from the shared TAKATAK Supabase backend. Master-data projection remains isolated for CRM/reporting."
        : "Rentauto operational database is unavailable; projection metrics may still be visible.",
      customers: operational?.customers ?? profiles.length,
      projectedCustomers: profiles.length,
      verifiedEmailProfiles,
      verifiedPhoneProfiles,
      paymentSummaries: payments.length,
      paidAmountMinor,
      refundedAmountMinor,
      currency: operational?.currency ?? projectionCurrency ?? "CAD",
      lastSynchronizedAt: lastSynchronized?.toISOString() ?? null,
      settlements: operational?.settlements ?? emptySettlements(),
      operations: operational?.operations ?? emptyOperations(),
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        status: event.status,
        createdAt: event.createdAt.toISOString(),
        processedAt: event.processedAt?.toISOString() ?? null,
      })),
    };
  } catch (error) {
    console.error(
      "[rentauto-admin] Operational/projection query failed:",
      error instanceof Error ? error.message : "unknown_error",
    );

    return emptyData("Rentauto operational data is temporarily unavailable.");
  }
}
