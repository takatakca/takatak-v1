import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

/** Incremental cadence: every 6 hours with per-Page jitter. */
export const FACEBOOK_INCREMENTAL_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Jitter band so Pages do not sync simultaneously (±30 minutes). */
export const FACEBOOK_INCREMENTAL_JITTER_MS = 30 * 60 * 1000;
/** Overlap days re-fetched to capture delayed Meta corrections. */
export const FACEBOOK_DEFAULT_OVERLAP_DAYS = 2;
/** First-connection recent window (priority before deep backfill). */
export const FACEBOOK_INITIAL_RECENT_DAYS = 28;
/** Historical backfill horizon Meta typically supports for Page insights. */
export const FACEBOOK_BACKFILL_HORIZON_DAYS = 90;
/** Each backfill job covers at most this many days. */
export const FACEBOOK_BACKFILL_WINDOW_DAYS = 14;

export type FacebookAnalyticsRangePreset =
  | "last_7"
  | "last_30"
  | "last_90"
  | "current_month"
  | "previous_month"
  | "custom";

export type FacebookDateRange = {
  preset: FacebookAnalyticsRangePreset;
  start: string;
  end: string;
  timezone: string;
  compareStart: string | null;
  compareEnd: string | null;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Format a calendar date in the given IANA timezone as YYYY-MM-DD.
 * Uses Intl so DST transitions stay correct for that zone.
 */
export function formatDateInTimeZone(
  instant: Date,
  timeZone: string,
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall through to UTC.
  }
  return instant.toISOString().slice(0, 10);
}

/** Shift a YYYY-MM-DD by N calendar days (UTC date arithmetic). */
export function shiftDateOnly(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetweenInclusive(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00.000Z`);
  const b = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) {
    return 0;
  }
  return Math.floor((b - a) / 86_400_000) + 1;
}

function monthStartInZone(instant: Date, timeZone: string): string {
  const today = formatDateInTimeZone(instant, timeZone);
  return `${today.slice(0, 7)}-01`;
}

function previousMonthRange(
  instant: Date,
  timeZone: string,
): { start: string; end: string } {
  const today = formatDateInTimeZone(instant, timeZone);
  const [yearRaw, monthRaw] = today.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const start = `${prevYear}-${pad2(prevMonth)}-01`;
  // Last day of previous month = day 0 of current month in UTC calendar math.
  const endDate = new Date(Date.UTC(year, month - 1, 0));
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

/**
 * Resolve a reporting range in brand/Page timezone.
 * `end` is inclusive and never later than "yesterday" in that timezone
 * (Meta daily insights for "today" are incomplete).
 */
export function resolveFacebookAnalyticsRange(options: {
  preset: FacebookAnalyticsRangePreset;
  timezone: string;
  customStart?: string | null;
  customEnd?: string | null;
  compare?: boolean;
  now?: Date;
}): FacebookDateRange {
  const timeZone = options.timezone.trim() || "UTC";
  const now = options.now ?? new Date();
  const today = formatDateInTimeZone(now, timeZone);
  const yesterday = shiftDateOnly(today, -1);

  let start = yesterday;
  let end = yesterday;

  switch (options.preset) {
    case "last_7":
      start = shiftDateOnly(yesterday, -6);
      break;
    case "last_30":
      start = shiftDateOnly(yesterday, -29);
      break;
    case "last_90":
      start = shiftDateOnly(yesterday, -89);
      break;
    case "current_month":
      start = monthStartInZone(now, timeZone);
      end = yesterday;
      if (start > end) {
        start = end;
      }
      break;
    case "previous_month": {
      const previous = previousMonthRange(now, timeZone);
      start = previous.start;
      end = previous.end > yesterday ? yesterday : previous.end;
      break;
    }
    case "custom": {
      const customStart = options.customStart?.trim() ?? "";
      const customEnd = options.customEnd?.trim() ?? "";
      start = /^\d{4}-\d{2}-\d{2}$/.test(customStart) ? customStart : shiftDateOnly(yesterday, -29);
      end = /^\d{4}-\d{2}-\d{2}$/.test(customEnd) ? customEnd : yesterday;
      if (end > yesterday) end = yesterday;
      if (start > end) start = end;
      // Cap custom retention to backfill horizon.
      const earliest = shiftDateOnly(yesterday, -(FACEBOOK_BACKFILL_HORIZON_DAYS - 1));
      if (start < earliest) start = earliest;
      break;
    }
    default:
      start = shiftDateOnly(yesterday, -29);
  }

  let compareStart: string | null = null;
  let compareEnd: string | null = null;
  if (options.compare) {
    const length = daysBetweenInclusive(start, end);
    compareEnd = shiftDateOnly(start, -1);
    compareStart = shiftDateOnly(compareEnd, -(length - 1));
  }

  return {
    preset: options.preset,
    start,
    end,
    timezone: timeZone,
    compareStart,
    compareEnd,
  };
}

/**
 * Compute Meta since/until for an incremental sync with overlap.
 * Prefer watermark; fall back to recent initial window.
 */
export function computeIncrementalFetchWindow(options: {
  lastConfirmedDate: string | null;
  overlapDays?: number;
  timezone: string;
  now?: Date;
}): { since: string; until: string; mode: "incremental" | "initial" } {
  const overlap = Math.max(
    0,
    options.overlapDays ?? FACEBOOK_DEFAULT_OVERLAP_DAYS,
  );
  const today = formatDateInTimeZone(options.now ?? new Date(), options.timezone);
  const until = shiftDateOnly(today, -1);

  if (options.lastConfirmedDate) {
    const since = shiftDateOnly(options.lastConfirmedDate, -overlap);
    return {
      since: since > until ? until : since,
      until,
      mode: "incremental",
    };
  }

  return {
    since: shiftDateOnly(until, -(FACEBOOK_INITIAL_RECENT_DAYS - 1)),
    until,
    mode: "initial",
  };
}

/** Split [horizonStart, recentStart) into older windows for backfill (oldest last). */
export function planBackfillWindows(options: {
  horizonStart: string;
  recentStart: string;
  windowDays?: number;
}): Array<{ since: string; until: string }> {
  const windowDays = options.windowDays ?? FACEBOOK_BACKFILL_WINDOW_DAYS;
  if (options.horizonStart >= options.recentStart) {
    return [];
  }

  const windows: Array<{ since: string; until: string }> = [];
  let cursorEnd = shiftDateOnly(options.recentStart, -1);

  while (cursorEnd >= options.horizonStart) {
    const since = shiftDateOnly(cursorEnd, -(windowDays - 1));
    const clampedSince =
      since < options.horizonStart ? options.horizonStart : since;
    windows.push({ since: clampedSince, until: cursorEnd });
    cursorEnd = shiftDateOnly(clampedSince, -1);
  }

  // Priority: recent-adjacent windows first.
  return windows;
}

/** Deterministic jitter from account id so schedules spread without Math.random. */
export function computeIncrementalJitterMs(socialAccountId: string): number {
  let hash = 0;
  for (let i = 0; i < socialAccountId.length; i += 1) {
    hash = (hash * 31 + socialAccountId.charCodeAt(i)) >>> 0;
  }
  const centered = (hash % (FACEBOOK_INCREMENTAL_JITTER_MS * 2 + 1)) -
    FACEBOOK_INCREMENTAL_JITTER_MS;
  return centered;
}

export function computeNextIncrementalAt(
  socialAccountId: string,
  from: Date = new Date(),
): Date {
  return new Date(
    from.getTime() +
      FACEBOOK_INCREMENTAL_INTERVAL_MS +
      computeIncrementalJitterMs(socialAccountId),
  );
}

/**
 * Enqueue due incremental syncs for ready Facebook Pages without dashboard traffic.
 * Does not run Meta I/O — only creates durable jobs when none are in flight.
 */
export async function scheduleDueFacebookPageIncrementalSyncs(options?: {
  clientId?: string;
  limit?: number;
  now?: Date;
}): Promise<{ enqueued: number; skipped: number }> {
  const prisma = getPrisma();
  if (!prisma) {
    return { enqueued: 0, skipped: 0 };
  }

  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 10;
  const started = Date.now();

  const due = await prisma.socialAccountSyncState.findMany({
    where: {
      ...(options?.clientId ? { clientId: options.clientId } : {}),
      status: { in: ["ready", "degraded", "empty"] },
      OR: [
        { nextIncrementalAt: null },
        { nextIncrementalAt: { lte: now } },
      ],
      dispatchJobId: null,
      socialAccount: {
        platform: "facebook",
        accountType: "facebook_page",
        status: "connected",
        accessStatus: "selected",
      },
      providerConnection: {
        provider: "meta",
        status: "connected",
      },
    },
    select: {
      id: true,
      clientId: true,
      businessBrandId: true,
      socialAccountId: true,
      providerConnectionId: true,
      lastConfirmedDate: true,
      overlapDays: true,
      timezone: true,
    },
    orderBy: { nextIncrementalAt: "asc" },
    take: limit,
  });

  let enqueued = 0;
  let skipped = 0;

  for (const row of due) {
    try {
      const { claimAndEnqueueFacebookPageSync } = await import(
        "@/lib/social/sync/facebook-page-sync-job"
      );

      const connection = await prisma.socialProviderConnection.findFirst({
        where: {
          id: row.providerConnectionId,
          clientId: row.clientId,
        },
        select: { createdByProfileId: true },
      });

      const profileId = connection?.createdByProfileId;
      if (!profileId) {
        skipped += 1;
        continue;
      }

      const timezone = row.timezone?.trim() || "UTC";
      const window = computeIncrementalFetchWindow({
        lastConfirmedDate: row.lastConfirmedDate
          ? row.lastConfirmedDate.toISOString().slice(0, 10)
          : null,
        overlapDays: row.overlapDays,
        timezone,
        now,
      });

      const result = await claimAndEnqueueFacebookPageSync({
        clientId: row.clientId,
        profileId,
        connectionId: row.providerConnectionId,
        socialAccountId: row.socialAccountId,
        businessBrandId: row.businessBrandId,
        rangeStart: window.since,
        rangeEnd: window.until,
        timezone,
        resumeCursor: null,
        resume: false,
        mode: window.mode,
        scheduleImmediate: false,
      });

      if (result.claimed) {
        enqueued += 1;
        await prisma.socialAccountSyncState.updateMany({
          where: { id: row.id },
          data: {
            nextIncrementalAt: computeNextIncrementalAt(
              row.socialAccountId,
              now,
            ),
            lastSyncMode: window.mode,
          },
        });
      } else {
        skipped += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  logSocialOAuthEvent("facebook-page-sync", {
    stage: "schedule_incremental",
    outcome: "ok",
    provider: "meta",
    writeCreated: enqueued,
    writeUnchanged: skipped,
    msTotal: Date.now() - started,
  });

  return { enqueued, skipped };
}
