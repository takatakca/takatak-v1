import type { TenantAccess } from "@/lib/security/tenant-access";
import { getPrisma } from "@/lib/db/prisma";

export type DashboardServiceModule = "rentauto";

const DASHBOARD_SERVICE_MODULES: DashboardServiceModule[] = ["rentauto"];

/**
 * ServiceInstance is the commercial source of truth for optional TAKATAK modules.
 *
 * A client-scoped workspace only receives modules that have been provisioned
 * and are usable. Platform administrators retain visibility so they can support
 * provisioning and diagnose access without impersonating a client subscription.
 */
export async function getEnabledServiceModules(
  access: TenantAccess,
): Promise<DashboardServiceModule[]> {
  if (access.mode === "foundation_demo" || access.mode === "platform_admin") {
    return [...DASHBOARD_SERVICE_MODULES];
  }

  if (access.mode !== "client_scoped") {
    return [];
  }

  const prisma = getPrisma();
  if (!prisma) return [];

  const services = await prisma.serviceInstance.findMany({
    where: {
      clientId: access.activeClientId,
      serviceType: { in: DASHBOARD_SERVICE_MODULES },
      status: { in: ["active", "pending_setup"] },
    },
    select: {
      serviceType: true,
    },
  });

  return [
    ...new Set(
      services
        .map((service) => service.serviceType)
        .filter(
          (serviceType): serviceType is DashboardServiceModule =>
            DASHBOARD_SERVICE_MODULES.includes(
              serviceType as DashboardServiceModule,
            ),
        ),
    ),
  ];
}

export async function hasEnabledServiceModule(
  access: TenantAccess,
  module: DashboardServiceModule,
): Promise<boolean> {
  const enabled = await getEnabledServiceModules(access);
  return enabled.includes(module);
}
