import type { RoleKey } from "@/lib/security/roles";
import {
  AHMV_CONTROL_ACTIONS,
  AHMV_CONTROL_SERVICES,
  DEFAULT_MANAGED_ASSOCIATION_PRODUCT_CODE,
  type AhmvControlAction,
  type AhmvControlRole,
  type AhmvControlService,
  type ManagedAssociationGrant,
} from "./contracts";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/;
const SAFE_ID_MAX = 160;

const ROLE_ACTIONS: Record<AhmvControlRole, readonly AhmvControlAction[]> = {
  owner: AHMV_CONTROL_ACTIONS,
  admin: AHMV_CONTROL_ACTIONS.filter((action) => action !== "delete"),
  manager: ["read", "save_draft", "publish", "archive", "restore"],
  operator: ["read", "save_draft", "execute"],
  viewer: ["read"],
};

export function isSafeAhmvControlId(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized.length > 0 &&
    normalized.length <= SAFE_ID_MAX &&
    SAFE_ID.test(normalized)
  );
}

export function isAhmvControlService(
  value: string,
): value is AhmvControlService {
  return (AHMV_CONTROL_SERVICES as readonly string[]).includes(value);
}

export function mapWorkspaceRoleToAhmvControlRole(
  role: RoleKey,
): AhmvControlRole {
  switch (role) {
    case "owner":
      return "owner";
    case "admin":
      return "admin";
    case "manager":
      return "manager";
    case "editor":
    case "staff":
      return "operator";
    case "viewer":
      return "viewer";
  }
}

export function grantAllowsAhmvControl(
  grant: ManagedAssociationGrant,
  options: {
    now?: Date;
    expectedProductCode?: string;
  } = {},
): boolean {
  const now = options.now ?? new Date();
  const expectedProductCode =
    options.expectedProductCode ?? DEFAULT_MANAGED_ASSOCIATION_PRODUCT_CODE;

  if (
    !isSafeAhmvControlId(grant.organizationId) ||
    !isSafeAhmvControlId(grant.actorId) ||
    !isSafeAhmvControlId(grant.subscriptionId) ||
    !isSafeAhmvControlId(grant.productCode) ||
    grant.productCode !== expectedProductCode ||
    !["trialing", "active", "grace"].includes(grant.status)
  ) {
    return false;
  }

  const validUntil = new Date(grant.validUntil);
  if (
    !Number.isFinite(validUntil.getTime()) ||
    validUntil.getTime() <= now.getTime()
  ) {
    return false;
  }

  const services = [...new Set(grant.enabledServices)];
  return (
    services.length > 0 &&
    services.every((service) => isAhmvControlService(service))
  );
}

export function canGrantPerformAhmvAction(
  grant: ManagedAssociationGrant,
  service: AhmvControlService,
  action: AhmvControlAction,
  options: {
    now?: Date;
    expectedProductCode?: string;
  } = {},
): boolean {
  if (!grantAllowsAhmvControl(grant, options)) return false;
  if (!grant.enabledServices.includes(service)) return false;
  return ROLE_ACTIONS[grant.role].includes(action);
}

export function assertGrantCanPerformAhmvAction(
  grant: ManagedAssociationGrant,
  service: AhmvControlService,
  action: AhmvControlAction,
  options: {
    now?: Date;
    expectedProductCode?: string;
  } = {},
): void {
  if (!canGrantPerformAhmvAction(grant, service, action, options)) {
    throw new Error("ahmv_control_grant_denied");
  }
}
