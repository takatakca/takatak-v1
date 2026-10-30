import { NextResponse } from "next/server";

import { MasterApiInputError, MasterApiUnavailableError } from "@/lib/integrations/master-api/errors";
import {
  authorizeMasterScope,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";
import { MASTER_API_ROUTE_SCOPES, sourceForScope } from "@/lib/integrations/master-api/scope";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Contract C4 (docs/ON2GO_HUB_ECOSYSTEM.md in foodhubca): ON2GO Hub reads what TAKATAK knows about one of its
// merchants: the master merchant id and the plan / status that the merchant.* events recorded. Read-only, scoped to
// the caller's own source: a Food Hub key only sees merchants Food Hub itself registered. Nothing personal travels.
export async function POST(request: Request) {
  const auth = authorizeMasterScope(request, MASTER_API_ROUTE_SCOPES.merchantEntitlements);
  if (auth.response) return auth.response;

  try {
    const { body } = await readMasterJson(request);
    const source = sourceForScope(body["source_application"], auth.scope);
    if (!source.ok) throw new MasterApiInputError(source.error);

    const externalMerchantId =
      typeof body["local_vendor_id"] === "string" ? body["local_vendor_id"].trim() : "";
    if (!externalMerchantId || externalMerchantId.length > 200) {
      throw new MasterApiInputError("Vendor id is required.");
    }

    const prisma = getPrisma();
    if (!prisma) throw new MasterApiUnavailableError("Database is unavailable.");

    const merchant = await prisma.sourceMerchant.findUnique({
      where: {
        sourceApplication_externalMerchantId: {
          sourceApplication: source.source,
          externalMerchantId,
        },
      },
      select: {
        merchantId: true,
        storeName: true,
        storeSlug: true,
        marketplaceStatus: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        lastSynchronizedAt: true,
      },
    });

    if (!merchant) {
      return NextResponse.json({ ok: true, known: false }, { status: 200 });
    }

    return NextResponse.json({
      ok: true,
      known: true,
      master_merchant_id: merchant.merchantId,
      store_name: merchant.storeName,
      store_slug: merchant.storeSlug,
      marketplace_status: merchant.marketplaceStatus,
      subscription_status: merchant.subscriptionStatus,
      subscription_plan: merchant.subscriptionPlan,
      synchronized_at: merchant.lastSynchronizedAt.toISOString(),
    });
  } catch (error) {
    return masterApiError(error);
  }
}
