export const DASHBOARD_SERVICE_MODULES = ["rentauto"] as const;

export type DashboardServiceModule =
  (typeof DASHBOARD_SERVICE_MODULES)[number];

export const ENABLED_SERVICE_STATUSES = [
  "active",
  "pending_setup",
] as const;

export function isDashboardServiceModule(
  value: string,
): value is DashboardServiceModule {
  return (DASHBOARD_SERVICE_MODULES as readonly string[]).includes(value);
}

export function isEnabledServiceStatus(
  value: string,
): boolean {
  return (ENABLED_SERVICE_STATUSES as readonly string[]).includes(value);
}
