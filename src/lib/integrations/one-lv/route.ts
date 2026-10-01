import { NextResponse } from "next/server";

import { verifyOneLvAuthorization } from "@/lib/integrations/one-lv/auth";

export const MAX_ONE_LV_BODY_BYTES = 100_000;

export async function readAuthorizedOneLvJson(request: Request):
  Promise<
    | { ok: true; rawBody: string; body: unknown }
    | { ok: false; response: NextResponse }
  > {
  const auth = verifyOneLvAuthorization(request.headers);
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { accepted: false, error: auth.error },
        { status: auth.status },
      ),
    };
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      ok: false,
      response: NextResponse.json(
        { accepted: false, error: "Content-Type must be application/json." },
        { status: 415 },
      ),
    };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_ONE_LV_BODY_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        { accepted: false, error: "Payload too large." },
        { status: 413 },
      ),
    };
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_ONE_LV_BODY_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        { accepted: false, error: "Payload too large." },
        { status: 413 },
      ),
    };
  }

  try {
    return {
      ok: true,
      rawBody,
      body: JSON.parse(rawBody) as unknown,
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { accepted: false, error: "Invalid JSON payload." },
        { status: 400 },
      ),
    };
  }
}
