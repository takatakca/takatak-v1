import "server-only";

import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import {
  MasterApiInputError,
  MasterApiUnavailableError,
} from "./errors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MasterMerchantPayload = {
  source_application?: string;
  master_merchant_id?: string | null;
  local_vendor_id?: string;
  local_owner_user_id?: string | null;
  store_name?: string;
  store_slug?: string | null;
  legal_business_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: Record<string, unknown> | null;
  marketplace_status?: string | null;
  subscription_status?: string | null;
  subscription_plan?: string | null;
  created_at?: string | null;
};

export async function resolveMasterMerchant(
  payload: MasterMerchantPayload,
): Promise<{ id: string; sourceMerchantId: string }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new MasterApiUnavailableError("Database is unavailable.");
  }

  const source = payload.source_application?.trim().toLowerCase() ?? "";
  if (source !== "1lv") {
    throw new MasterApiInputError("Unsupported source application.");
  }

  const externalMerchantId = payload.local_vendor_id?.trim() ?? "";
  const storeName = payload.store_name?.trim() ?? "";

  if (!externalMerchantId || externalMerchantId.length > 200 || !storeName) {
    throw new MasterApiInputError("Vendor id and store name are required.");
  }

  const explicitId = payload.master_merchant_id?.trim() ?? "";
  if (explicitId && !UUID_RE.test(explicitId)) {
    throw new MasterApiInputError("Invalid master merchant id.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.sourceMerchant.findUnique({
      where: {
        sourceApplication_externalMerchantId: {
          sourceApplication: source,
          externalMerchantId,
        },
      },
      include: { merchant: true },
    });

    if (existing) {
      const merchant = await tx.masterMerchant.update({
        where: { id: existing.merchantId },
        data: {
          legalName:
            existing.merchant.legalName ??
            payload.legal_business_name?.trim() ??
            undefined,
          primaryEmail:
            existing.merchant.primaryEmail ??
            payload.contact_email?.trim().toLowerCase() ??
            undefined,
          primaryPhone:
            existing.merchant.primaryPhone ??
            payload.contact_phone?.trim() ??
            undefined,
        },
      });

      const sourceMerchant = await tx.sourceMerchant.update({
        where: { id: existing.id },
        data: {
          ownerExternalUserId: payload.local_owner_user_id?.trim() || null,
          storeName,
          storeSlug: payload.store_slug?.trim() || null,
          collectedFields: payload as Prisma.InputJsonValue,
          marketplaceStatus: payload.marketplace_status?.trim() || null,
          subscriptionStatus: payload.subscription_status?.trim() || null,
          subscriptionPlan: payload.subscription_plan?.trim() || null,
          lastSynchronizedAt: new Date(),
        },
      });

      return { id: merchant.id, sourceMerchantId: sourceMerchant.id };
    }

    const linked = explicitId
      ? await tx.masterMerchant.findUnique({ where: { id: explicitId } })
      : null;

    if (explicitId && !linked) {
      throw new MasterApiInputError("Master merchant link does not exist.");
    }

    const master =
      linked ??
      (await tx.masterMerchant.create({
        data: {
          legalName: payload.legal_business_name?.trim() || storeName,
          primaryEmail: payload.contact_email?.trim().toLowerCase() || null,
          primaryPhone: payload.contact_phone?.trim() || null,
        },
      }));

    const sourceMerchant = await tx.sourceMerchant.create({
      data: {
        merchantId: master.id,
        sourceApplication: source,
        externalMerchantId,
        ownerExternalUserId: payload.local_owner_user_id?.trim() || null,
        storeName,
        storeSlug: payload.store_slug?.trim() || null,
        collectedFields: payload as Prisma.InputJsonValue,
        marketplaceStatus: payload.marketplace_status?.trim() || null,
        subscriptionStatus: payload.subscription_status?.trim() || null,
        subscriptionPlan: payload.subscription_plan?.trim() || null,
        lastSynchronizedAt: new Date(),
      },
    });

    return { id: master.id, sourceMerchantId: sourceMerchant.id };
  });
}
