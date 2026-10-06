// Agent autopilot schedules — pure time math (no I/O; safe for QA).
// A schedule fires at the top of `hour` in the client's own time zone, every
// day or on one weekday. DST is handled by asking Intl for each hour's local
// wall time instead of doing offset arithmetic.

export type ScheduleKind = "off" | "daily" | "weekly";

export interface AgentSchedule {
  schedule: ScheduleKind;
  weekday: number | null; // 0 = Sunday … 6 = Saturday (local)
  hour: number; // 0–23 local
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function localParts(instant: Date, timeZone: string): { weekday: number; hour: number } {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", hourCycle: "h23" });
    formatterCache.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(instant);
  const weekday = WEEKDAYS[parts.find((p) => p.type === "weekday")?.value ?? "Sun"] ?? 0;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  return { weekday, hour };
}

/** Most recent scheduled instant at or before `now`, or null when the schedule is off/invalid. */
export function latestDueSlot(now: Date, schedule: AgentSchedule, timeZone: string): Date | null {
  if (schedule.schedule === "off") return null;
  if (!Number.isInteger(schedule.hour) || schedule.hour < 0 || schedule.hour > 23) return null;
  if (schedule.schedule === "weekly" && (schedule.weekday === null || schedule.weekday < 0 || schedule.weekday > 6)) return null;
  const tz = isValidTimeZone(timeZone) ? timeZone : "America/Toronto";
  const start = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
  const horizonHours = schedule.schedule === "daily" ? 26 : 7 * 24 + 2;
  for (let i = 0; i <= horizonHours; i += 1) {
    const instant = new Date(start - i * 3_600_000);
    const local = localParts(instant, tz);
    if (local.hour !== schedule.hour) continue;
    if (schedule.schedule === "weekly" && local.weekday !== schedule.weekday) continue;
    return instant;
  }
  return null;
}

export function parseScheduleInput(raw: { schedule?: unknown; weekday?: unknown; hour?: unknown }): AgentSchedule {
  const kind: ScheduleKind = raw.schedule === "daily" || raw.schedule === "weekly" ? raw.schedule : "off";
  const hour = Number(raw.hour);
  const weekday = Number(raw.weekday);
  return {
    schedule: kind,
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 9,
    weekday: kind === "weekly" && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : kind === "weekly" ? 1 : null,
  };
}
