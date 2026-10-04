import { NextResponse } from "next/server";

import { verifyAhmvScheduleRequest } from "@/lib/integrations/ahmv/auth";
import {
  AhmvScheduleUnavailableError,
  readAhmvScheduleSnapshot,
} from "@/lib/integrations/ahmv/schedule-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function queryValue(url: URL, name: string, max: number) {
  const value = url.searchParams.get(name)?.trim() ?? "";
  return value ? value.slice(0, max) : undefined;
}

async function handle(request: Request) {
  const verification = verifyAhmvScheduleRequest(request.headers, "read");
  if (!verification.valid) {
    return json({ ok: false, error: verification.error }, verification.status);
  }

  const url = new URL(request.url);
  const teamId = queryValue(url, "teamId", 80);
  const team = queryValue(url, "team", 80);
  const category = queryValue(url, "category", 80);
  const date = queryValue(url, "date", 10);

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ ok: false, error: "Invalid date." }, 400);
  }

  try {
    const result = await readAhmvScheduleSnapshot({
      ...(teamId ? { teamId } : {}),
      ...(team ? { team } : {}),
      ...(category ? { category } : {}),
      ...(date ? { date } : {}),
    });

    if (!result.available) {
      const response = json(
        {
          ok: false,
          error: "AHMV schedule is not currently fresh.",
          reason: result.reason,
          updatedAt: result.updatedAt ?? null,
          sourceUrl: result.sourceUrl ?? null,
        },
        503,
      );
      response.headers.set("Retry-After", "60");
      return response;
    }

    return json({
      status: result.status,
      updatedAt: result.updatedAt,
      sourceUrl: result.sourceUrl,
      events: result.events,
    });
  } catch (error) {
    if (error instanceof AhmvScheduleUnavailableError) {
      const response = json(
        { ok: false, error: "AHMV schedule store is unavailable." },
        503,
      );
      response.headers.set("Retry-After", "60");
      return response;
    }

    console.error(
      "[ahmv-schedule] read failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return json({ ok: false, error: "AHMV schedule could not be read." }, 503);
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function HEAD(request: Request) {
  const response = await handle(request);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
