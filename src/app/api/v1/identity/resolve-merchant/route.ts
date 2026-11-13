import { NextResponse } from "next/server";

import {
  authorizeMasterScope,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";
import { MASTER_API_ROUTE_SCOPES } from "@/lib/integrations/master-api/scope";
import {
  resolveMasterMerchant,
  type MasterMerchantPayload,
} from "@/lib/integrations/master-api/merchant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = authorizeMasterScope(request, MASTER_API_ROUTE_SCOPES.resolveMerchant);
  if (auth.response) return auth.response;

  try {
    const { body } = await readMasterJson(request);
    const resolved = await resolveMasterMerchant(
      body as MasterMerchantPayload,
      auth.scope,
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
