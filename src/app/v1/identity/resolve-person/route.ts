import { NextResponse } from "next/server";

import {
  OneLvIdentityConflictError,
  resolveOneLvPerson,
} from "@/lib/integrations/one-lv/master";
import { readAuthorizedOneLvJson } from "@/lib/integrations/one-lv/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const input = await readAuthorizedOneLvJson(request);
  if (!input.ok) return input.response;

  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) {
    return NextResponse.json({ error: "Invalid person payload." }, { status: 400 });
  }

  try {
    const result = await resolveOneLvPerson(
      input.body as Record<string, unknown>,
    );
    return NextResponse.json({
      id: result.id,
      source_profile_id: result.sourceProfileId,
      created: result.created,
    });
  } catch (error) {
    if (error instanceof OneLvIdentityConflictError) {
      return NextResponse.json(
        { error: "Identity conflict requires review.", conflicts: error.fields },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Identity resolution failed." },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
}
