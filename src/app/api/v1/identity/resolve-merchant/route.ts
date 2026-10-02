import { NextResponse } from "next/server";

import {
  authorizeMasterRequest,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";
import {
  resolveMasterMerchant,
  type MasterMerchantPayload,
} from "@/lib/integrations/master-api/merchant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = authorizeMasterRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const { body } = await readMasterJson(request);
    const resolved = await resolveMasterMerchant(
      body as MasterMerchantPayload,
    );

    return NextResponse.json({
      ok: true,
      id: resolved.id,
      source_merchant_id: resolved.sourceMerchantId,
    });
  } catch (error) {
    return masterApiError(error);
  }
}
