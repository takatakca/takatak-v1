import "server-only";

import { getPrisma } from "@/lib/db/prisma";

export type MasterCrmIdentitySummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  sources: string[];
  relationshipCount: number;
  orderCount: number;
  updatedAt: string;
};

export type MasterCrmCompanySummary = {
  id: string;
  displayName: string;
  legalName: string | null;
  email: string | null;
  province: string | null;
  status: string | null;
  merchantCount: number;
  relationshipCount: number;
  orderCount: number;
  updatedAt: string;
};

export type MasterCrmRelationshipSummary = {
  id: string;
  customer: string;
  merchant: string;
  orderCount: number | null;
  lifetimeValue: string | null;
  currency: string;
  lastSeenAt: string | null;
};

export type MasterCrmOrderSummary = {
  id: string;
  orderNumber: string;
  customer: string;
  total: string;
  currency: string;
  paymentStatus: string | null;
  fulfillmentStatus: string | null;
  occurredAt: string;
};

export type MasterCrmData =
  | {
      source: "database";
      sourceLabel: string;
      kpis: {
        identities: number;
        companies: number;
        merchants: number;
        relationships: number;
        orders: number;
        processedEvents: number;
      };
      identities: MasterCrmIdentitySummary[];
      companies: MasterCrmCompanySummary[];
      relationships: MasterCrmRelationshipSummary[];
      orders: MasterCrmOrderSummary[];
    }
  | {
      source: "unavailable";
      sourceLabel: string;
      kpis: {
        identities: 0;
        companies: 0;
        merchants: 0;
        relationships: 0;
        orders: 0;
        processedEvents: 0;
      };
      identities: [];
      companies: [];
      relationships: [];
      orders: [];
    };

const empty: MasterCrmData = {
  source: "unavailable",
  sourceLabel: "Master CRM database is unavailable.",
  kpis: {
    identities: 0,
    companies: 0,
    merchants: 0,
    relationships: 0,
    orders: 0,
    processedEvents: 0,
  },
  identities: [],
  companies: [],
  relationships: [],
  orders: [],
};

function name(first: string | null, last: string | null, fallback: string | null) {
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || fallback || "Unidentified customer";
}

export async function getMasterCrmData(): Promise<MasterCrmData> {
  const prisma = getPrisma();
  if (!prisma) return empty;

  try {
    const [
      identities,
      companies,
      merchants,
      relationships,
      orders,
      processedEvents,
      recentIdentities,
      recentCompanies,
      recentRelationships,
      recentOrders,
    ] = await Promise.all([
      prisma.masterIdentity.count({
        where: { sourceProfiles: { some: { sourceApplication: "1lv" } } },
      }),
      prisma.masterCompany.count({
        where: { sourceMerchants: { some: { sourceApplication: "1lv" } } },
      }),
      prisma.sourceMerchant.count({ where: { sourceApplication: "1lv" } }),
      prisma.marketplaceRelationship.count({ where: { sourceApplication: "1lv" } }),
      prisma.sourceMarketplaceOrder.count({ where: { sourceApplication: "1lv" } }),
      prisma.sourceSynchronizationEvent.count({
        where: { sourceApplication: "1lv", status: "PROCESSED" },
      }),
      prisma.masterIdentity.findMany({
        where: { sourceProfiles: { some: { sourceApplication: "1lv" } } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          primaryEmail: true,
          primaryPhone: true,
          primaryEmailVerified: true,
          primaryPhoneVerified: true,
          updatedAt: true,
          sourceProfiles: {
            select: { sourceApplication: true },
            orderBy: { sourceApplication: "asc" },
          },
          _count: { select: { marketplaceRelationships: true, sourceOrders: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 25,
      }),
      prisma.masterCompany.findMany({
        where: { sourceMerchants: { some: { sourceApplication: "1lv" } } },
        select: {
          id: true,
          displayName: true,
          legalName: true,
          primaryEmail: true,
          province: true,
          status: true,
          updatedAt: true,
          _count: { select: { sourceMerchants: true, relationships: true, sourceOrders: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 25,
      }),
      prisma.marketplaceRelationship.findMany({
        where: { sourceApplication: "1lv" },
        select: {
          id: true,
          sourceCustomerRef: true,
          orderCount: true,
          lifetimeValue: true,
          currency: true,
          lastSeenAt: true,
          identity: { select: { firstName: true, lastName: true, primaryEmail: true } },
          company: { select: { displayName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      prisma.sourceMarketplaceOrder.findMany({
        where: { sourceApplication: "1lv" },
        select: {
          id: true,
          externalOrderNumber: true,
          externalOrderId: true,
          customerReference: true,
          total: true,
          currency: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          occurredAt: true,
          identity: { select: { firstName: true, lastName: true, primaryEmail: true } },
        },
        orderBy: { occurredAt: "desc" },
        take: 30,
      }),
    ]);

    return {
      source: "database",
      sourceLabel: "TAKATAK Master CRM — live 1LV.CA source records.",
      kpis: { identities, companies, merchants, relationships, orders, processedEvents },
      identities: recentIdentities.map((row) => ({
        id: row.id,
        name: name(row.firstName, row.lastName, row.primaryEmail),
        email: row.primaryEmail,
        phone: row.primaryPhone,
        emailVerified: row.primaryEmailVerified,
        phoneVerified: row.primaryPhoneVerified,
        sources: [...new Set(row.sourceProfiles.map((source) => source.sourceApplication))],
        relationshipCount: row._count.marketplaceRelationships,
        orderCount: row._count.sourceOrders,
        updatedAt: row.updatedAt.toISOString(),
      })),
      companies: recentCompanies.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        legalName: row.legalName,
        email: row.primaryEmail,
        province: row.province,
        status: row.status,
        merchantCount: row._count.sourceMerchants,
        relationshipCount: row._count.relationships,
        orderCount: row._count.sourceOrders,
        updatedAt: row.updatedAt.toISOString(),
      })),
      relationships: recentRelationships.map((row) => ({
        id: row.id,
        customer: row.identity
          ? name(row.identity.firstName, row.identity.lastName, row.identity.primaryEmail)
          : row.sourceCustomerRef,
        merchant: row.company.displayName,
        orderCount: row.orderCount,
        lifetimeValue: row.lifetimeValue?.toFixed(2) ?? null,
        currency: row.currency,
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      })),
      orders: recentOrders.map((row) => ({
        id: row.id,
        orderNumber: row.externalOrderNumber ?? row.externalOrderId,
        customer: row.identity
          ? name(row.identity.firstName, row.identity.lastName, row.identity.primaryEmail)
          : row.customerReference ?? "Guest",
        total: row.total.toFixed(2),
        currency: row.currency,
        paymentStatus: row.paymentStatus,
        fulfillmentStatus: row.fulfillmentStatus,
        occurredAt: row.occurredAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error(
      "[master-crm] Query failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return empty;
  }
}
