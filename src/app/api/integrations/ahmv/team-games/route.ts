import { NextResponse } from "next/server";

import { verifyAhmvScheduleRequest } from "@/lib/integrations/ahmv/auth";
import { buildAhmvTeamGames } from "@/lib/integrations/ahmv/team-games";
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

function publicTeamId(value: string | null): string | undefined {
  const normalized = value?.trim() ?? "";
  return /^[A-Za-z0-9._:-]{4,80}$/.test(normalized) ? normalized : undefined;
}

async function handle(request: Request) {
  const verification = verifyAhmvScheduleRequest(request.headers, "read");
  if (!verification.valid) {
    return json({ status: "unauthorized", error: verification.error }, verification.status);
  }

  const url = new URL(request.url);
  const teamId = publicTeamId(url.searchParams.get("teamId"));
  if (!teamId) return json({ status: "invalid_team" }, 400);

  const scopedTeamId = publicTeamId(request.headers.get("x-ahmv-team-id"));
  if (!scopedTeamId || scopedTeamId !== teamId) {
    return json({ status: "team_scope_mismatch" }, 403);
  }

  try {
    const result = await readAhmvScheduleSnapshot({ teamId });

    if (!result.available) {
      const response = json(
        {
          status: "unavailable",
          reason: result.reason,
          updatedAt: result.updatedAt ?? null,
          sourceUrl: result.sourceUrl ?? null,
        },
        503,
      );
      response.headers.set("Retry-After", "60");
      return response;
    }

    const games = buildAhmvTeamGames(result.events);

    if (!games.nextGame && !games.latestResult && games.recentResults.length === 0) {
      return json({
        status: "not_connected",
        teamId,
        updatedAt: result.updatedAt,
        sourceUrl: result.sourceUrl,
        recentResults: [],
      });
    }

    return json({
      status: "active",
      teamId,
      updatedAt: result.updatedAt,
      sourceUrl: result.sourceUrl,
      ...(games.nextGame ? { nextGame: games.nextGame } : {}),
      ...(games.latestResult ? { latestResult: games.latestResult } : {}),
      recentResults: games.recentResults,
    });
  } catch (error) {
    if (error instanceof AhmvScheduleUnavailableError) {
      const response = json({ status: "unavailable" }, 503);
      response.headers.set("Retry-After", "60");
      return response;
    }

    console.error(
      "[ahmv-team-games] read failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return json({ status: "unavailable" }, 503);
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
