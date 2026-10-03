import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

export const RENTAUTO_MANAGED_STATUSES = [
  "pending_setup",
  "active",
  "paused",
] as const;

export type RentautoManagedStatus =
  (typeof RENTAUTO_MANAGED_STATUSES)[number];

export interface AdminRentautoProvisioningRow {
  clientId: string;
  clientName: string;
  clientStatus: string;
  serviceId: string | null;
  serviceStatus: string | null;
  duplicateCount: number;
}

export async function getAdminRentautoProvisioningData(
  authorized: boolean,
): Promise<AdminRentautoProvisioningRow[]> {
  if (!authorized) return [];

  const prisma = getPrisma();
  if (!prisma) return [];

  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      serviceInstances: {
        where: {
          serviceType: "rentauto",
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return clients.map((client) => {
    const first = client.serviceInstances[0] ?? null;

    return {
      clientId: client.id,
      clientName: client.name,
      clientStatus: client.status,
      serviceId: first?.id ?? null,
      serviceStatus: first?.status ?? null,
      duplicateCount: Math.max(0, client.serviceInstances.length - 1),
    };
  });
}

export async function setRentautoServiceStatus(params: {
  clientId: string;
  status: RentautoManagedStatus;
  actorProfileId: string;
}) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The service provisioning database is unavailable.",
    );
  }

  return prisma.$transaction(async (transaction) => {
    const client = await transaction.client.findUnique({
      where: {
        id: params.clientId,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!client) {
      throw new ServiceError(
        "not_found",
        "The selected workspace could not be found.",
      );
    }

    const existing = await transaction.serviceInstance.findMany({
      where: {
        clientId: params.clientId,
        serviceType: "rentauto",
      },
      select: {
        id: true,
        status: true,
        name: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (existing.length > 1) {
      throw new ServiceError(
        "conflict",
        "Multiple Rentauto service records exist for this workspace. Resolve the duplicate records before changing access.",
      );
    }

    const current = existing[0] ?? null;

    if (!current && params.status === "paused") {
      throw new ServiceError(
        "conflict",
        "Rentauto must be provisioned before it can be paused.",
      );
    }

    if (current?.status === params.status) {
      return {
        id: current.id,
        status: current.status,
        clientId: client.id,
        clientName: client.name,
        changed: false,
      };
    }

    const previousStatus = current?.status ?? "not_provisioned";

    const service = current
      ? await transaction.serviceInstance.update({
          where: {
            id: current.id,
          },
          data: {
            status: params.status,
            provider: "rentauto",
          },
          select: {
            id: true,
            status: true,
          },
        })
      : await transaction.serviceInstance.create({
          data: {
            clientId: client.id,
            businessBrandId: null,
            serviceType: "rentauto",
            provider: "rentauto",
            name: "RENTAUTO.CA",
            status: params.status,
            currency: "CAD",
            metadata: {
              managedBy: "GROUPE TAKATAK",
              applicationUrl: "https://rentauto.ca",
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

    const action =
      previousStatus === "not_provisioned"
        ? "rentauto_service_provisioned"
        : params.status === "paused"
          ? "rentauto_service_paused"
          : previousStatus === "paused"
            ? "rentauto_service_reactivated"
            : "rentauto_service_status_changed";

    await transaction.auditLog.create({
      data: {
        profileId: params.actorProfileId,
        clientId: client.id,
        action,
        entityType: "ServiceInstance",
        entityId: service.id,
        metadata: {
          note: `RENTAUTO.CA access for ${client.name} changed from ${previousStatus} to ${params.status}.`,
          serviceType: "rentauto",
          previousStatus,
          newStatus: params.status,
        },
      },
    });

    return {
      id: service.id,
      status: service.status,
      clientId: client.id,
      clientName: client.name,
      changed: true,
    };
  });
}
