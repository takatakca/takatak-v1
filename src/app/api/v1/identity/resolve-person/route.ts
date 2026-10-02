import { NextResponse } from "next/server";

import {
  authorizeMasterRequest,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";
import {
  resolveMasterPerson,
  type MasterPersonPayload,
} from "@/lib/integrations/master-api/identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = authorizeMasterRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const { body } = await readMasterJson(request);
    const identity = await resolveMasterPerson(
      body as MasterPersonPayload,
    );

    return NextResponse.json({
      ok: true,
      id: identity.id,
      source_profile_id: identity.sourceProfileId,
    });
  } catch (error) {
    return masterApiError(error);
  }
}
