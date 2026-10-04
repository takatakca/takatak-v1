import "server-only";

import {
  AHMV_CONTROL_PRODUCT,
  AHMV_CONTROL_TENANT,
  type AhmvControlCommand,
  type AhmvControlCommandInput,
  type AhmvControlEnvelope,
  type ManagedAssociationGrant,
} from "./contracts";
import {
  assertGrantCanPerformAhmvAction,
  isSafeAhmvControlId,
} from "./policy";
import { assertSafeAhmvControlPayload } from "./payload-policy";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;

function normalizedId(value: string, error: string) {
  const clean = value.trim();
  if (!isSafeAhmvControlId(clean)) throw new Error(error);
  return clean;
}

export function buildAhmvControlEnvelope(input: {
  serviceToken: string;
  grant: ManagedAssociationGrant;
  command: AhmvControlCommandInput;
  now?: Date;
  expectedProductCode?: string;
}): AhmvControlEnvelope {
  const token = input.serviceToken.trim();
  if (token.length < 32) {
    throw new Error("ahmv_control_service_token_not_configured");
  }

  assertGrantCanPerformAhmvAction(
    input.grant,
    input.command.service,
    input.command.action,
    {
      now: input.now,
      expectedProductCode: input.expectedProductCode,
    },
  );

  const requestId = normalizedId(
    input.command.requestId,
    "ahmv_control_invalid_request_id",
  );
  const resourceType = normalizedId(
    input.command.resourceType,
    "ahmv_control_invalid_resource_type",
  );
  const resourceId = normalizedId(
    input.command.resourceId,
    "ahmv_control_invalid_resource_id",
  );
  const idempotencyKey = input.command.idempotencyKey.trim();
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
    throw new Error("ahmv_control_invalid_idempotency_key");
  }
  if (
    input.command.expectedRevision !== undefined &&
    (!Number.isInteger(input.command.expectedRevision) ||
      input.command.expectedRevision < 1)
  ) {
    throw new Error("ahmv_control_invalid_expected_revision");
  }

  const payload = input.command.payload ?? {};
  assertSafeAhmvControlPayload(payload);

  const command: AhmvControlCommand = {
    tenant: AHMV_CONTROL_TENANT,
    organizationId: input.grant.organizationId,
    actorId: input.grant.actorId,
    requestId,
    idempotencyKey,
    service: input.command.service,
    action: input.command.action,
    resourceType,
    resourceId,
    ...(input.command.expectedRevision !== undefined
      ? { expectedRevision: input.command.expectedRevision }
      : {}),
    payload,
  };

  return {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-takatak-tenant": AHMV_CONTROL_TENANT,
      "x-takatak-product": AHMV_CONTROL_PRODUCT,
      "x-takatak-organization-id": input.grant.organizationId,
      "x-takatak-actor-id": input.grant.actorId,
      "x-request-id": requestId,
    },
    grant: {
      ...input.grant,
      enabledServices: [...new Set(input.grant.enabledServices)],
    },
    command,
  };
}
