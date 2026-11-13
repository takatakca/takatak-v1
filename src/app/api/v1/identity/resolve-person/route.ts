import { NextResponse } from "next/server";

import {
  authorizeMasterScope,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";
import { MASTER_API_ROUTE_SCOPES } from "@/lib/integrations/master-api/scope";
import {
  resolveMasterPerson,
  type MasterPersonPayload,
} from "@/lib/integrations/master-api/identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = authorizeMasterScope(request, MASTER_API_ROUTE_SCOPES.resolvePerson);
  if (auth.response) return auth.response;

  try {
    const { body } = await readMasterJson(request);
    const identity = await resolveMasterPerson(
      body as MasterPersonPayload,
      auth.scope,
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
