import { NextResponse } from "next/server";

import { verifyAhmvScheduleRequest } from "@/lib/integrations/ahmv/auth";
import {
  AhmvScheduleUnavailableError,
  readAhmvScheduleSnapshot,
} from "@/lib/integrations/ahmv/schedule-store";
import { buildAhmvTeamGames } from "@/lib/integrations/ahmv/team-games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function teamIdFrom(request: Request) {
  const url = new URL(request.url);
  const queryTeamId = url.searchParams.get("teamId")?.trim() ?? "";
  const headerTeamId = request.headers.get("x-ahmv-team-id")?.trim() ?? "";

  if (!queryTeamId || queryTeamId.length > 80) {
    return { ok: false as const, status: 400, error: "Invalid teamId." };
  }
  if (!headerTeamId || headerTeamId !== queryTeamId) {
    return {
      ok: false as const,
      status: 403,
      error: "AHMV team binding is required.",
    };
  }

  return { ok: true as const, teamId: queryTeamId };
}

async function handle(request: Request) {
  const verification = verifyAhmvScheduleRequest(request.headers, "read");
  if (!verification.valid) {
    return json({ ok: false, error: verification.error }, verification.status);
  }

  const teamBinding = teamIdFrom(request);
  if (!teamBinding.ok) {
    return json(
      { ok: false, error: teamBinding.error },
      teamBinding.status,
    );
  }

  try {
    const result = await readAhmvScheduleSnapshot({
      teamId: teamBinding.teamId,
    });

    if (!result.available) {
      const response = json(
        {
          ok: false,
          error: "AHMV team games are not currently fresh.",
          reason: result.reason,
          updatedAt: result.updatedAt ?? null,
          sourceUrl: result.sourceUrl ?? null,
        },
        503,
      );
      response.headers.set("Retry-After", "60");
      return response;
    }

    if (result.events.length === 0) {
      return json(
        {
          status: "not_connected",
          updatedAt: result.updatedAt,
          sourceUrl: result.sourceUrl,
          recentResults: [],
        },
        404,
      );
    }

    const games = buildAhmvTeamGames(result.events);
    const active =
      Boolean(games.nextGame) ||
      Boolean(games.latestResult) ||
      games.recentResults.length > 0;

    return json({
      status: active ? "active" : "connected",
      updatedAt: result.updatedAt,
      sourceUrl: result.sourceUrl,
      ...(games.nextGame ? { nextGame: games.nextGame } : {}),
      ...(games.latestResult ? { latestResult: games.latestResult } : {}),
      recentResults: games.recentResults,
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
      "[ahmv-team-games] read failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return json({ ok: false, error: "AHMV team games could not be read." }, 503);
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
