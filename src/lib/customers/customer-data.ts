import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { clientWhere, resolveDataScope } from "@/lib/security/data-scope";
import type { TenantAccess } from "@/lib/security/tenant-access";

export type CustomerDatabaseSource = "database" | "unavailable";

export type CustomerListRow = {
  id: string;
  workspaceName: string;
  brandName: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  evidenceStatus: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  reservationCount: number;
  interactionCount: number;
  sourceCount: number;
};

export type CustomerDatabasePageData = {
  source: CustomerDatabaseSource;
  sourceLabel: string;
  globalView: boolean;
  query: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  customers: CustomerListRow[];
};

export type CustomerReservationRow = {
  id: string;
  reservationNumber: string;
  sourceSystem: string;
  accommodationCode: string | null;
  accommodationType: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  nights: number | null;
  adults: number | null;
  children: number | null;
  statusText: string | null;
  totalMinor: number | null;
  paidMinor: number | null;
  balanceMinor: number | null;
  currency: string;
  sourceUrl: string | null;
};

export type CustomerInteractionRow = {
  id: string;
  occurredAt: string | null;
  direction: string | null;
  channel: string;
  subject: string | null;
  snippet: string | null;
  sourceAccount: string | null;
  sourceUrl: string | null;
};

export type CustomerEvidenceRow = {
  id: string;
  sourceType: string;
  sourceSystem: string;
  sourceAccount: string | null;
  sourceRecordId: string | null;
  sourceDate: string | null;
  subject: string | null;
  sourceUrl: string | null;
};

export type CustomerDetailData =
  | {
      source: "database";
      sourceLabel: string;
      globalView: boolean;
      customer: {
        id: string;
        workspaceName: string;
        brandName: string | null;
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        phone: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        region: string | null;
        postalCode: string | null;
        country: string | null;
        evidenceStatus: string;
        firstSeenAt: string | null;
        lastSeenAt: string | null;
        reservationCount: number;
        interactionCount: number;
        sourceCount: number;
        metadata: Prisma.JsonValue | null;
        reservations: CustomerReservationRow[];
        interactions: CustomerInteractionRow[];
        evidence: CustomerEvidenceRow[];
      };
    }
  | {
      source: "unavailable";
      sourceLabel: string;
      globalView: boolean;
    }
  | {
      source: "not_found";
      sourceLabel: string;
      globalView: boolean;
    };

const PAGE_SIZE = 50;

function day(value: Date | null | undefined): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function timestamp(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null;
}

function cleanQuery(value: string | undefined): string {
  return (value ?? "").trim().slice(0, 160);
}

export async function getCustomerDatabasePage(
  access: TenantAccess,
  rawQuery?: string,
  rawPage = 1,
): Promise<CustomerDatabasePageData> {
  const scope = await resolveDataScope(access);
  const query = cleanQuery(rawQuery);
  const page = Math.max(1, Math.floor(rawPage || 1));

  if (scope.kind !== "db") {
    return {
      source: "unavailable",
      sourceLabel: scope.label,
      globalView: false,
      query,
      page,
      pageSize: PAGE_SIZE,
      total: 0,
      totalPages: 1,
      customers: [],
    };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return {
      source: "unavailable",
      sourceLabel: "Customer database is not configured.",
      globalView: scope.clientIds === null,
      query,
      page,
      pageSize: PAGE_SIZE,
      total: 0,
      totalPages: 1,
      customers: [],
    };
  }

  const where: Prisma.CustomerProfileWhereInput = {
    ...clientWhere(scope),
    ...(query
      ? {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
            { postalCode: { contains: query, mode: "insensitive" } },
            {
              reservations: {
                some: {
                  reservationNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  try {
    const total = await prisma.customerProfile.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);

    const rows = await prisma.customerProfile.findMany({
      where,
      include: {
        client: { select: { name: true } },
        businessBrand: { select: { name: true } },
        _count: {
          select: {
            reservations: true,
            interactions: true,
            sourceEvidence: true,
          },
        },
      },
      orderBy: [{ lastSeenAt: "desc" }, { displayName: "asc" }],
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    return {
      source: "database",
      sourceLabel:
        scope.clientIds === null
          ? "TAKATAK global customer intelligence — all workspaces."
          : "Private customer intelligence — restricted to the active workspace.",
      globalView: scope.clientIds === null,
      query,
      page: safePage,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
      customers: rows.map((row) => ({
        id: row.id,
        workspaceName: row.client.name,
        brandName: row.businessBrand?.name ?? null,
        displayName: row.displayName,
        email: row.email,
        phone: row.phone,
        city: row.city,
        region: row.region,
        evidenceStatus: row.evidenceStatus,
        firstSeenAt: day(row.firstSeenAt),
        lastSeenAt: day(row.lastSeenAt),
        reservationCount: row._count.reservations,
        interactionCount: row._count.interactions,
        sourceCount: row._count.sourceEvidence,
      })),
    };
  } catch (error) {
    console.error(
      "[customer-data:list] Customer database query failed:",
      error instanceof Error ? error.message : "unknown error",
    );

    return {
      source: "unavailable",
      sourceLabel: "Customer data is temporarily unavailable.",
      globalView: scope.clientIds === null,
      query,
      page,
      pageSize: PAGE_SIZE,
      total: 0,
      totalPages: 1,
      customers: [],
    };
  }
}

export async function getCustomerDetailData(
  access: TenantAccess,
  customerId: string,
): Promise<CustomerDetailData> {
  const scope = await resolveDataScope(access);

  if (scope.kind !== "db") {
    return {
      source: "unavailable",
      sourceLabel: scope.label,
      globalView: false,
    };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return {
      source: "unavailable",
      sourceLabel: "Customer database is not configured.",
      globalView: scope.clientIds === null,
    };
  }

  try {
    const row = await prisma.customerProfile.findFirst({
      where: {
        id: customerId,
        ...clientWhere(scope),
      },
      include: {
        client: { select: { name: true } },
        businessBrand: { select: { name: true } },
        reservations: {
          orderBy: [{ arrivalDate: "desc" }, { reservationNumber: "desc" }],
          take: 250,
        },
        interactions: {
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          take: 250,
        },
        sourceEvidence: {
          orderBy: [{ sourceDate: "desc" }, { createdAt: "desc" }],
          take: 250,
        },
        _count: {
          select: {
            reservations: true,
            interactions: true,
            sourceEvidence: true,
          },
        },
      },
    });

    if (!row) {
      return {
        source: "not_found",
        sourceLabel: "Customer record was not found in the permitted workspace.",
        globalView: scope.clientIds === null,
      };
    }

    return {
      source: "database",
      sourceLabel:
        scope.clientIds === null
          ? "TAKATAK global customer intelligence — all workspaces."
          : "Private customer intelligence — restricted to the active workspace.",
      globalView: scope.clientIds === null,
      customer: {
        id: row.id,
        workspaceName: row.client.name,
        brandName: row.businessBrand?.name ?? null,
        displayName: row.displayName,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        city: row.city,
        region: row.region,
        postalCode: row.postalCode,
        country: row.country,
        evidenceStatus: row.evidenceStatus,
        firstSeenAt: day(row.firstSeenAt),
        lastSeenAt: day(row.lastSeenAt),
        reservationCount: row._count.reservations,
        interactionCount: row._count.interactions,
        sourceCount: row._count.sourceEvidence,
        metadata: row.metadata,
        reservations: row.reservations.map((reservation) => ({
          id: reservation.id,
          reservationNumber: reservation.reservationNumber,
          sourceSystem: reservation.sourceSystem,
          accommodationCode: reservation.accommodationCode,
          accommodationType: reservation.accommodationType,
          arrivalDate: day(reservation.arrivalDate),
          departureDate: day(reservation.departureDate),
          nights: reservation.nights,
          adults: reservation.adults,
          children: reservation.children,
          statusText: reservation.statusText,
          totalMinor: reservation.totalMinor,
          paidMinor: reservation.paidMinor,
          balanceMinor: reservation.balanceMinor,
          currency: reservation.currency,
          sourceUrl: reservation.sourceUrl,
        })),
        interactions: row.interactions.map((interaction) => ({
          id: interaction.id,
          occurredAt: timestamp(interaction.occurredAt),
          direction: interaction.direction,
          channel: interaction.channel,
          subject: interaction.subject,
          snippet: interaction.snippet,
          sourceAccount: interaction.sourceAccount,
          sourceUrl: interaction.sourceUrl,
        })),
        evidence: row.sourceEvidence.map((evidence) => ({
          id: evidence.id,
          sourceType: evidence.sourceType,
          sourceSystem: evidence.sourceSystem,
          sourceAccount: evidence.sourceAccount,
          sourceRecordId: evidence.sourceRecordId,
          sourceDate: timestamp(evidence.sourceDate),
          subject: evidence.subject,
          sourceUrl: evidence.sourceUrl,
        })),
      },
    };
  } catch (error) {
    console.error(
      "[customer-data:detail] Customer database query failed:",
      error instanceof Error ? error.message : "unknown error",
    );

    return {
      source: "unavailable",
      sourceLabel: "Customer data is temporarily unavailable.",
      globalView: scope.clientIds === null,
    };
  }
}
