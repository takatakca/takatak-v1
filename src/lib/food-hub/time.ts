// Local-time helpers (Montréal by default). The business day starts at local midnight.

export function foodhubTimeZone(): string {
  return process.env.FOODHUB_TIMEZONE || 'America/Toronto';
}

export function localParts(ms: number, timeZone = foodhubTimeZone()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ms)).reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute, second: +parts.second };
}

/** Local wall-clock time without zone, e.g. "2026-10-01 14:30:00" (JET Connect onlineAt format). */
export function localTimestamp(ms: number, timeZone = foodhubTimeZone()): string {
  const p = localParts(ms, timeZone);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${z(p.month)}-${z(p.day)} ${z(p.hour)}:${z(p.minute)}:${z(p.second)}`;
}

/** Offset (ms) of the zone from UTC at instant `ms`. */
function zoneOffset(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** UTC epoch ms of local midnight for the business day containing `ms`. */
export function startOfLocalDayMs(ms = Date.now(), timeZone = foodhubTimeZone()): number {
  const p = localParts(ms, timeZone);
  const guess = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  let start = guess - zoneOffset(guess, timeZone);
  // Correct once more in case the offset changed between guess and real midnight (DST days).
  start = guess - zoneOffset(start, timeZone);
  return start;
}

export function localHour(ms: number, timeZone = foodhubTimeZone()): number {
  return localParts(ms, timeZone).hour;
}

export function localDateLabel(ms = Date.now(), timeZone = foodhubTimeZone()): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(ms));
}
