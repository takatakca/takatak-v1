import "server-only";

import type { ServiceStatus, ServiceType } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";

/** One TAKATAK service a client has, as the client sees it (no internal provider data). */
export interface ClientServiceRow {
  id: string;
  name: string;
  serviceType: ServiceType;
  status: ServiceStatus;
  brandName: string | null;
  renewalDate: Date | null;
}

/**
 * The workspace's own services, cancelled ones left out. Always scoped to the
 * one client id; returns null when the database is not configured.
 */
export async function listClientServices(clientId: string): Promise<ClientServiceRow[] | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const rows = await prisma.serviceInstance.findMany({
    where: { clientId, status: { not: "cancelled" } },
    select: {
      id: true,
      name: true,
      serviceType: true,
      status: true,
      renewalDate: true,
      businessBrand: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    serviceType: row.serviceType,
    status: row.status,
    brandName: row.businessBrand?.name ?? null,
    renewalDate: row.renewalDate,
  }));
}

/** Where each kind of service is managed in the dashboard, with its French and English names. */
export const SERVICE_TYPE_INFO: Record<ServiceType, { label: string; href: string }> = {
  social_media: { label: "Réseaux sociaux · Social media", href: "/dashboard/social" },
  web_hosting: { label: "Site Web et hébergement · Website & hosting", href: "/dashboard/web-hosting" },
  domain: { label: "Domaine · Domain", href: "/dashboard/web-hosting/domains" },
  local_listings: { label: "Fiches locales · Local listings", href: "/dashboard/local-listings" },
  leads: { label: "Prospects · Leads", href: "/dashboard/leads" },
  ai_studio: { label: "Studio IA · AI Studio", href: "/dashboard/ai-studio" },
  reports: { label: "Rapports · Reports", href: "/dashboard/reports" },
  billing: { label: "Facturation · Billing", href: "/dashboard/billing" },
  support: { label: "Soutien · Support", href: "/dashboard/support" },
  custom: { label: "Service sur mesure · Custom service", href: "/dashboard/support" },
  rentauto: { label: "Location auto · RentAuto", href: "/dashboard/rentauto" },
};

export const SERVICE_STATUS_INFO: Record<ServiceStatus, { label: string; tone: "success" | "accent" | "warning" | "danger" | "muted" }> = {
  active: { label: "Actif · Active", tone: "success" },
  pending_setup: { label: "Mise en place · Being set up", tone: "accent" },
  planned: { label: "Prévu · Planned", tone: "muted" },
  paused: { label: "En pause · Paused", tone: "warning" },
  failed: { label: "À corriger · Needs attention", tone: "danger" },
  cancelled: { label: "Annulé · Cancelled", tone: "muted" },
};
