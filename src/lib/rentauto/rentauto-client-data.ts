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
  lastSynchronizedAt: string | null;
  roles: string[];
  upcomingTripCount: number;
  activeTripCount: number;
  unreadNotifications: number;
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
    upcomingTripCount: number;
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
    lastSynchronizedAt: null,
    roles: [],
    upcomingTripCount: 0,
    activeTripCount: 0,
    unreadNotifications: 0,
    nextTrip: null,
    host: {
      applicationStatus: null,
      verificationStatus: null,
      vehicleCount: 0,
      activeVehicleCount: 0,
      upcomingTripCount: 0,
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
  | "upcomingTripCount"
  | "activeTripCount"
  | "unreadNotifications"
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
      upcomingTripCount: 0,
      activeTripCount: 0,
      unreadNotifications: 0,
      nextTrip: null,
      host: {
        applicationStatus: null,
        verificationStatus: null,
        vehicleCount: 0,
        activeVehicleCount: 0,
        upcomingTripCount: 0,
        payoutsReady: false,
      },
    };
  }

  // Selecting the module should provision the least-privileged Rentauto account
  // for an already-verified shared TAKATAK identity. This never grants host/admin.
  await admin.rpc("bootstrap_rentauto_account", {
    p_auth_user_id: authUserId,
  });

  const db = admin.schema("rentauto");
  const [
    rolesResult,
    guestTripsResult,
    carsResult,
    hostApplicationResult,
    verificationResult,
    stripeResult,
    notificationsResult,
  ] = await Promise.all([
    db
      .from("account_roles")
      .select("role")
      .eq("auth_user_id", authUserId),
    db
      .from("trips")
      .select(
        "id,booking_reference,status,start_at,end_at,total_cents,currency,car_id",
      )
      .eq("guest_id", authUserId)
      .not("status", "in", '("completed","cancelled")')
      .order("start_at", { ascending: true }),
    db
      .from("cars")
      .select("id,status")
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
  ]);

  const roles = (rolesResult.data ?? [])
    .map((row) => (typeof row.role === "string" ? row.role : ""))
    .filter(Boolean);

  const guestTrips = guestTripsResult.data ?? [];
  const activeTripCount = guestTrips.filter((trip) =>
    ["check_in_pending", "active", "check_out_pending"].includes(
      String(trip.status),
    ),
  ).length;

  const carIds = (carsResult.data ?? []).map((car) => String(car.id));
  let hostUpcomingTripCount = 0;
  if (carIds.length > 0) {
    const hostTripsResult = await db
      .from("trips")
      .select("id", { count: "exact", head: true })
      .in("car_id", carIds)
      .not("status", "in", '("completed","cancelled")');
    hostUpcomingTripCount = hostTripsResult.count ?? 0;
  }

  const next = guestTrips[0] ?? null;
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
      currency:
        typeof next.currency === "string" ? next.currency : "CAD",
      vehicleName:
        car && typeof car.title === "string" && car.title.trim()
          ? car.title
          : fallbackVehicle,
    };
  }

  const cars = carsResult.data ?? [];
  const stripe = stripeResult.data;

  return {
    roles,
    upcomingTripCount: guestTrips.length,
    activeTripCount,
    unreadNotifications: notificationsResult.count ?? 0,
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
      upcomingTripCount: hostUpcomingTripCount,
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
      ...emptyData("Rentauto is ready to link after shared identity verification."),
      emailVerified: profile.masterIdentity.primaryEmailVerified,
      phoneVerified: profile.masterIdentity.primaryPhoneVerified,
      ...operational,
    };
  }

  return {
    linked: true,
    sourceLabel:
      "Live Rentauto account connected to your TAKATAK master identity.",
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
