import "server-only";

// GROUPE TAKATAK Billing — resolve the Facturations actor for a verified
// TAKATAK platform admin. Callers must pass the role returned by
// requirePlatformAdminApiAccess() / requireAdminAccess(), never request input.

import { getPrisma } from "@/lib/db/prisma";

import type { FacturationsActor } from "./client";
import {
  facturationsRoleForPlatformRole,
  facturationsSubject,
  type TakatakPlatformRole,
} from "./identity";

export async function resolveFacturationsActor(input: {
  profileId: string | null;
  platformRole: TakatakPlatformRole | null;
}): Promise<FacturationsActor | null> {
  const role = facturationsRoleForPlatformRole(input.platformRole);

  if (!role || !input.profileId) {
    return null;
  }

  const prisma = getPrisma();

  if (!prisma) {
    return null;
  }

  const masterIdentity = await prisma.masterIdentity.findUnique({
    where: { profileId: input.profileId },
    select: { id: true },
  });

  return {
    role,
    subject: facturationsSubject({
      masterIdentityId: masterIdentity?.id ?? null,
      profileId: input.profileId,
    }),
  };
}
