export const AHMV_CONTROL_TENANT = "ahmverdun" as const;
export const AHMV_CONTROL_PRODUCT = "ahmv" as const;
export const DEFAULT_MANAGED_ASSOCIATION_PRODUCT_CODE =
  "managed_hockey_association";

export const AHMV_CONTROL_SERVICES = [
  "website",
  "domain",
  "hosting",
  "seo",
  "social",
  "local_listing",
  "blog",
  "reviews",
  "lead_calls",
  "notifications",
  "sms",
  "voice",
  "email",
  "calendar",
  "analytics",
  "automations",
] as const;

export type AhmvControlService = (typeof AHMV_CONTROL_SERVICES)[number];

export const AHMV_CONTROL_ACTIONS = [
  "read",
  "save_draft",
  "publish",
  "archive",
  "restore",
  "delete",
  "execute",
] as const;

export type AhmvControlAction = (typeof AHMV_CONTROL_ACTIONS)[number];

export const AHMV_ASSOCIATION_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "grace",
  "suspended",
  "cancelled",
] as const;

export type AhmvAssociationSubscriptionStatus =
  (typeof AHMV_ASSOCIATION_SUBSCRIPTION_STATUSES)[number];

export type AhmvControlRole =
  | "owner"
  | "admin"
  | "manager"
  | "operator"
  | "viewer";

export type ManagedAssociationGrant = {
  organizationId: string;
  actorId: string;
  role: AhmvControlRole;
  subscriptionId: string;
  productCode: string;
  status: AhmvAssociationSubscriptionStatus;
  enabledServices: readonly AhmvControlService[];
  validUntil: string;
};

export type AhmvControlCommandInput = {
  requestId: string;
  idempotencyKey: string;
  service: AhmvControlService;
  action: AhmvControlAction;
  resourceType: string;
  resourceId: string;
  expectedRevision?: number;
  payload?: unknown;
};

export type AhmvControlCommand = {
  tenant: typeof AHMV_CONTROL_TENANT;
  organizationId: string;
  actorId: string;
  requestId: string;
  idempotencyKey: string;
  service: AhmvControlService;
  action: AhmvControlAction;
  resourceType: string;
  resourceId: string;
  expectedRevision?: number;
  payload: unknown;
};

export type AhmvControlEnvelope = {
  headers: Readonly<Record<string, string>>;
  grant: ManagedAssociationGrant;
  command: AhmvControlCommand;
};
