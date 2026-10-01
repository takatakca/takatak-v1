import "server-only";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { getPrisma } from "@/lib/db/prisma";

type PaymentSummary = {
  bookingNumber: string;
  status: string;
  amountMinor: number;
  refundedAmountMinor: number | null;
  currency: string;
  transactionDate: string;
};

export type RentautoClientData = {
  linked: boolean;
  sourceLabel: string;
  accountStatus: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  driverVerificationStatus: string | null;
  driverLicenseExpiresOn: string | null;
  lastSynchronizedAt: string | null;
  roles: string[];
  upcomingTripCount: number;
  pendingRequestCount: number;
  approvedAwaitingPaymentCount: number;
  activeTripCount: number;
  completedTripCount: number;
  lifetimePaidCents: number;
  unreadNotifications: number;
  openSupportCount: number;
  openIncidentCount: number;
  nextTrip: {
    id: string;
    bookingReference: string;
    status: string;
    startAt: string;
    endAt: string;
    totalCents: number | null;
    currency: string;
    vehicleName: string;
  } | null;
  host: {
    applicationStatus: string | null;
    verificationStatus: string | null;
    vehicleCount: number;
    activeVehicleCount: number;
    draftVehicleCount: number;
    pendingVehicleReviewCount: number;
    upcomingTripCount: number;
    pendingRequestCount: number;
    approvedAwaitingPaymentCount: number;
    activeTripCount: number;
    completedTripCount: number;
    grossBookingValueCents: number;
    payoutsReady: boolean;
  };
  paymentSummaries: PaymentSummary[];
};

function emptyData(sourceLabel: string): RentautoClientData {
  return {
    linked: false,
    sourceLabel,
    accountStatus: null,
    emailVerified: false,
    phoneVerified: false,
    driverVerificationStatus: null,
    driverLicenseExpiresOn: null,
    lastSynchronizedAt: null,
    roles: [],
    upcomingTripCount: 0,
    pendingRequestCount: 0,
    approvedAwaitingPaymentCount: 0,
    activeTripCount: 0,
    completedTripCount: 0,
    lifetimePaidCents: 0,
    unreadNotifications: 0,
    openSupportCount: 0,
    openIncidentCount: 0,
    nextTrip: null,
    host: {
      applicationStatus: null,
      verificationStatus: null,
      vehicleCount: 0,
      activeVehicleCount: 0,
      draftVehicleCount: 0,
      pendingVehicleReviewCount: 0,
      upcomingTripCount: 0,
      pendingRequestCount: 0,
      approvedAwaitingPaymentCount: 0,
      activeTripCount: 0,
      completedTripCount: 0,
      grossBookingValueCents: 0,
      payoutsReady: false,
    },
    paymentSummaries: [],
  };
}

function paymentRows(
  rows: Array<{
    bookingNumber: string;
    status: string;
    amountMinor: number;
    refundedAmountMinor: number | null;
    currency: string;
    transactionDate: Date;
  }>,
): PaymentSummary[] {
  return rows.map((payment) => ({
    bookingNumber: payment.bookingNumber,
    status: payment.status,
    amountMinor: payment.amountMinor,
    refundedAmountMinor: payment.refundedAmountMinor,
    currency: payment.currency,
    transactionDate: payment.transactionDate.toISOString(),
  }));
}

type OperationalSnapshot = Pick<
  RentautoClientData,
  | "roles"
  | "driverVerificationStatus"
  | "driverLicenseExpiresOn"
  | "upcomingTripCount"
  | "pendingRequestCount"
  | "approvedAwaitingPaymentCount"
  | "activeTripCount"
  | "completedTripCount"
  | "lifetimePaidCents"
  | "unreadNotifications"
  | "openSupportCount"
  | "openIncidentCount"
  | "nextTrip"
  | "host"
>;

async function getOperationalSnapshot(
  authUserId: string,
): Promise<OperationalSnapshot> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      roles: [],
      driverVerificationStatus: null,
      driverLicenseExpiresOn: null,
      upcomingTripCount: 0,
      activeTripCount: 0,
      completedTripCount: 0,
      lifetimePaidCents: 0,
      unreadNotifications: 0,
      openSupportCount: 0,
      openIncidentCount: 0,
      nextTrip: null,
      host: {
        applicationStatus: null,
        verificationStatus: null,
        vehicleCount: 0,
        activeVehicleCount: 0,
        draftVehicleCount: 0,
        pendingVehicleReviewCount: 0,
        upcomingTripCount: 0,
        activeTripCount: 0,
        completedTripCount: 0,
        grossBookingValueCents: 0,
        payoutsReady: false,
      },
    };
  }

  // Opening the TAKATAK module provisions only the least-privileged Rentauto
  // guest account for an already verified shared identity. Host/admin are never
  // granted here.
  await admin.rpc("bootstrap_rentauto_account", {
    p_auth_user_id: authUserId,
  });

  const db = admin.schema("rentauto");
  const [
    rolesResult,
    driverVerificationResult,
    guestTripsResult,
    carsResult,
    hostApplicationResult,
    verificationResult,
    stripeResult,
    notificationsResult,
    supportResult,
  ] = await Promise.all([
    db.from("account_roles").select("role").eq("auth_user_id", authUserId),
    db
      .from("driver_verifications")
      .select("status,license_expires_on")
      .eq("user_id", authUserId)
      .maybeSingle(),
    db
      .from("trips")
      .select(
        "id,booking_reference,status,payment_status,start_at,end_at,total_cents,currency,car_id",
      )
      .eq("guest_id", authUserId)
      .order("start_at", { ascending: true }),
    db
      .from("cars")
      .select("id,status,insurance_status")
      .eq("host_id", authUserId),
    db
      .from("host_applications")
      .select("status")
      .eq("user_id", authUserId)
      .maybeSingle(),
    db
      .from("host_verifications")
      .select("verification_status")
      .eq("user_id", authUserId)
      .maybeSingle(),
    db
      .from("stripe_accounts")
      .select("charges_enabled,payouts_enabled")
      .eq("user_id", authUserId)
      .maybeSingle(),
    db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .is("read_at", null),
    db
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .not("status", "in", '("resolved","closed")'),
  ]);

  const roles = (rolesResult.data ?? [])
    .map((row) => (typeof row.role === "string" ? row.role : ""))
    .filter(Boolean);

  const guestTrips = guestTripsResult.data ?? [];
  const activeStatuses = ["check_in_pending", "active", "check_out_pending"];
  const upcomingStatuses = ["confirmed", "check_in_pending", "active", "check_out_pending"];
  const relevantStatuses = ["requested", "approved", ...upcomingStatuses];

  const activeTripCount = guestTrips.filter((trip) =>
    activeStatuses.includes(String(trip.status)),
  ).length;
  const upcomingTripCount = guestTrips.filter((trip) =>
    upcomingStatuses.includes(String(trip.status)),
  ).length;
  const pendingRequestCount = guestTrips.filter(
    (trip) => String(trip.status) === "requested",
  ).length;
  const approvedAwaitingPaymentCount = guestTrips.filter(
    (trip) => String(trip.status) === "approved",
  ).length;
  const completedTripCount = guestTrips.filter(
    (trip) => String(trip.status) === "completed",
  ).length;
  const lifetimePaidCents = guestTrips.reduce((total, trip) => {
    if (String(trip.payment_status) !== "paid") return total;
    return total + (typeof trip.total_cents === "number" ? Math.max(0, trip.total_cents) : 0);
  }, 0);

  const next =
    guestTrips.find((trip) => relevantStatuses.includes(String(trip.status))) ??
    null;
  let nextTrip: OperationalSnapshot["nextTrip"] = null;

  if (next) {
    const carResult = await db
      .from("cars")
      .select("title,year,make,model")
      .eq("id", String(next.car_id))
      .maybeSingle();

    const car = carResult.data;
    const fallbackVehicle = car
      ? [car.year, car.make, car.model].filter(Boolean).join(" ")
      : "Rentauto vehicle";

    nextTrip = {
      id: String(next.id),
      bookingReference:
        typeof next.booking_reference === "string"
          ? next.booking_reference
          : "Rentauto booking",
      status: String(next.status),
      startAt: String(next.start_at),
      endAt: String(next.end_at),
      totalCents:
        typeof next.total_cents === "number" ? next.total_cents : null,
      currency: typeof next.currency === "string" ? next.currency : "CAD",
      vehicleName:
        car && typeof car.title === "string" && car.title.trim()
          ? car.title
          : fallbackVehicle,
    };
  }

  const cars = carsResult.data ?? [];
  const carIds = cars.map((car) => String(car.id));
  let hostTrips: Array<{
    id: unknown;
    status: unknown;
    payment_status: unknown;
    total_cents: unknown;
  }> = [];

  if (carIds.length > 0) {
    const hostTripsResult = await db
      .from("trips")
      .select("id,status,payment_status,total_cents")
      .in("car_id", carIds);
    hostTrips = hostTripsResult.data ?? [];
  }

  const relevantTripIds = [
    ...guestTrips.map((trip) => String(trip.id)),
    ...hostTrips.map((trip) => String(trip.id)),
  ];
  let openIncidentCount = 0;
  if (relevantTripIds.length > 0) {
    const incidentResult = await db
      .from("trip_incidents")
      .select("id", { count: "exact", head: true })
      .in("trip_id", [...new Set(relevantTripIds)])
      .eq("status", "open");
    openIncidentCount = incidentResult.count ?? 0;
  }

  const stripe = stripeResult.data;
  const hostActiveTripCount = hostTrips.filter((trip) =>
    activeStatuses.includes(String(trip.status)),
  ).length;
  const hostUpcomingTripCount = hostTrips.filter((trip) =>
    upcomingStatuses.includes(String(trip.status)),
  ).length;
  const hostPendingRequestCount = hostTrips.filter(
    (trip) => String(trip.status) === "requested",
  ).length;
  const hostApprovedAwaitingPaymentCount = hostTrips.filter(
    (trip) => String(trip.status) === "approved",
  ).length;
  const hostCompletedTripCount = hostTrips.filter(
    (trip) => String(trip.status) === "completed",
  ).length;
  const grossBookingValueCents = hostTrips.reduce((total, trip) => {
    if (String(trip.payment_status) !== "paid") return total;
    return total + (typeof trip.total_cents === "number" ? Math.max(0, trip.total_cents) : 0);
  }, 0);

  const rawDriverStatus =
    typeof driverVerificationResult.data?.status === "string"
      ? driverVerificationResult.data.status
      : "not_started";
  const driverLicenseExpiresOn =
    typeof driverVerificationResult.data?.license_expires_on === "string"
      ? driverVerificationResult.data.license_expires_on
      : null;
  const today = new Date().toISOString().slice(0, 10);
  const driverVerificationStatus =
    rawDriverStatus === "approved" &&
    (!driverLicenseExpiresOn || driverLicenseExpiresOn < today)
      ? "expired"
      : rawDriverStatus;

  return {
    roles,
    driverVerificationStatus,
    driverLicenseExpiresOn,
    upcomingTripCount,
    pendingRequestCount,
    approvedAwaitingPaymentCount,
    activeTripCount,
    completedTripCount,
    lifetimePaidCents,
    unreadNotifications: notificationsResult.count ?? 0,
    openSupportCount: supportResult.count ?? 0,
    openIncidentCount,
    nextTrip,
    host: {
      applicationStatus:
        typeof hostApplicationResult.data?.status === "string"
          ? hostApplicationResult.data.status
          : null,
      verificationStatus:
        typeof verificationResult.data?.verification_status === "string"
          ? verificationResult.data.verification_status
          : null,
      vehicleCount: cars.length,
      activeVehicleCount: cars.filter((car) => car.status === "active").length,
      draftVehicleCount: cars.filter((car) => car.status === "draft").length,
      pendingVehicleReviewCount: cars.filter(
        (car) => car.insurance_status === "pending",
      ).length,
      upcomingTripCount: hostUpcomingTripCount,
      pendingRequestCount: hostPendingRequestCount,
      approvedAwaitingPaymentCount: hostApprovedAwaitingPaymentCount,
      activeTripCount: hostActiveTripCount,
      completedTripCount: hostCompletedTripCount,
      grossBookingValueCents,
      payoutsReady: Boolean(
        stripe?.charges_enabled && stripe?.payouts_enabled,
      ),
    },
  };
}

export async function getRentautoClientData(): Promise<RentautoClientData> {
  const user = await getSessionUser();
  const prisma = getPrisma();

  if (!user || !prisma) {
    return emptyData("Rentauto account link is unavailable.");
  }

  const operational = await getOperationalSnapshot(user.id);

  const profile = await prisma.profile.findUnique({
    where: { authUserId: user.id },
    select: {
      id: true,
      masterIdentity: {
        select: {
          id: true,
          primaryEmailVerified: true,
          primaryPhoneVerified: true,
        },
      },
    },
  });

  if (!profile?.masterIdentity) {
    return {
      ...emptyData("No verified master identity is linked to this TAKATAK account yet."),
      ...operational,
    };
  }

  const source =
    (await prisma.sourceProfile.findUnique({
      where: {
        sourceApplication_externalUserId: {
          sourceApplication: "RENTAUTO",
          externalUserId: user.id,
        },
      },
      select: {
        id: true,
        accountStatus: true,
        verifiedFields: true,
        lastSynchronizedAt: true,
        paymentSummaries: {
          select: {
            bookingNumber: true,
            status: true,
            amountMinor: true,
            refundedAmountMinor: true,
            currency: true,
            transactionDate: true,
          },
          orderBy: { transactionDate: "desc" },
          take: 12,
        },
      },
    })) ??
    (await prisma.sourceProfile.findFirst({
      where: {
        identityId: profile.masterIdentity.id,
        sourceApplication: "RENTAUTO",
      },
      select: {
        id: true,
        accountStatus: true,
        verifiedFields: true,
        lastSynchronizedAt: true,
        paymentSummaries: {
          select: {
            bookingNumber: true,
            status: true,
            amountMinor: true,
            refundedAmountMinor: true,
            currency: true,
            transactionDate: true,
          },
          orderBy: { transactionDate: "desc" },
          take: 12,
        },
      },
    }));

  if (!source) {
    return {
      ...emptyData("Rentauto operational account is connected; master-data projection is not synchronized yet."),
      emailVerified: profile.masterIdentity.primaryEmailVerified,
      phoneVerified: profile.masterIdentity.primaryPhoneVerified,
      ...operational,
    };
  }

  return {
    linked: true,
    sourceLabel:
      "Live Rentauto operations connected to your TAKATAK master identity.",
    accountStatus: source.accountStatus,
    emailVerified:
      source.verifiedFields.includes("email") ||
      profile.masterIdentity.primaryEmailVerified,
    phoneVerified:
      source.verifiedFields.includes("phone") ||
      profile.masterIdentity.primaryPhoneVerified,
    lastSynchronizedAt: source.lastSynchronizedAt.toISOString(),
    paymentSummaries: paymentRows(source.paymentSummaries),
    ...operational,
  };
}
