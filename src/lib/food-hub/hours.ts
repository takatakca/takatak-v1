// Store hours, brand overrides, holidays and category schedules (Atlas "Schedules" / "Timing groups").
// One place to set hours; every platform receives them with the menu:
//   Uber Eats  → menus[].service_availability (+ POST holiday-hours)
//   DoorDash   → open_hours + special_hours (+ item hours for scheduled categories)
//   Skip       → menus[].availability (+ Food Hub takes the store offline on closed holidays)
import { nowIso } from './config';
import { getRepo } from './repo';
import { foodhubTimeZone, localParts, startOfLocalDayMs } from './time';
import type { DayKey, Holiday, HoursConfig, PublishContext, WeeklyHours } from './types';

export const DAYS: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export type Slot = { open: string; close: string };
const KEY = 'hours';

export function emptyWeek(): WeeklyHours {
  return Object.fromEntries(DAYS.map((d) => [d, []])) as unknown as WeeklyHours;
}

export function allDayWeek(): WeeklyHours {
  return Object.fromEntries(DAYS.map((d) => [d, [{ open: '00:00', close: '23:59' }]])) as unknown as WeeklyHours;
}

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Sorts, merges overlaps and splits overnight slots (22:00–02:00 → 22:00–23:59 + next day 00:00–02:00). */
export function normalizeWeek(week: Partial<WeeklyHours> | null | undefined): WeeklyHours {
  const out = emptyWeek();
  if (!week) return out;
  const add = (day: DayKey, a: number, b: number) => { if (b > a) out[day].push({ open: toHHMM(a), close: toHHMM(Math.min(b, 1439)) }); };
  DAYS.forEach((day, i) => {
    for (const s of week[day] ?? []) {
      if (!TIME.test(s.open) || !TIME.test(s.close)) continue;
      const a = toMin(s.open); const b = toMin(s.close);
      if (b > a) add(day, a, b);
      else if (b < a) { add(day, a, 1439); add(DAYS[(i + 1) % 7], 0, b); }
    }
  });
  for (const day of DAYS) {
    const sorted = out[day].map((s) => [toMin(s.open), toMin(s.close)]).sort((x, y) => x[0] - y[0]);
    const merged: number[][] = [];
    for (const [a, b] of sorted) {
      const last = merged[merged.length - 1];
      if (last && a <= last[1]) last[1] = Math.max(last[1], b); else merged.push([a, b]);
    }
    out[day] = merged.map(([a, b]) => ({ open: toHHMM(a), close: toHHMM(b) }));
  }
  return out;
}

export function weekErrors(week: Partial<WeeklyHours> | null | undefined): string[] {
  const errors: string[] = [];
  for (const day of DAYS) for (const s of week?.[day] ?? []) {
    if (!TIME.test(s.open) || !TIME.test(s.close)) errors.push(`${day}: times must be HH:MM (got ${s.open}–${s.close})`);
    else if (s.open === s.close) errors.push(`${day}: ${s.open}–${s.close} is an empty slot`);
  }
  return errors;
}

export function intersectWeeks(a: WeeklyHours, b: WeeklyHours): WeeklyHours {
  const out = emptyWeek();
  for (const day of DAYS) for (const x of a[day] ?? []) for (const y of b[day] ?? []) {
    const start = Math.max(toMin(x.open), toMin(y.open)); const end = Math.min(toMin(x.close), toMin(y.close));
    if (end > start) out[day].push({ open: toHHMM(start), close: toHHMM(end) });
  }
  return normalizeWeek(out);
}

export function weekIsEmpty(week: WeeklyHours | null | undefined): boolean {
  return !week || DAYS.every((d) => (week[d] ?? []).length === 0);
}

export function weekMinutes(week: WeeklyHours): number {
  return DAYS.reduce((sum, d) => sum + (week[d] ?? []).reduce((s, p) => s + toMin(p.close) - toMin(p.open), 0), 0);
}

// ---------- storage ----------

export async function getHours(): Promise<HoursConfig> {
  const stored = await getRepo().getKv<HoursConfig>(KEY).catch(() => null);
  return { locations: stored?.locations ?? {}, brands: stored?.brands ?? {}, holidays: stored?.holidays ?? [], updatedAt: stored?.updatedAt };
}

export async function saveHours(cfg: HoursConfig): Promise<HoursConfig> {
  const errors = [
    ...Object.entries(cfg.locations).flatMap(([loc, w]) => weekErrors(w).map((e) => `${loc} ${e}`)),
    ...Object.entries(cfg.brands).flatMap(([b, w]) => weekErrors(w).map((e) => `${b} ${e}`)),
    ...cfg.holidays.flatMap((h) => (/^\d{4}-\d{2}-\d{2}$/.test(h.date) ? [] : [`Holiday "${h.name}": date must be YYYY-MM-DD`])),
  ];
  if (errors.length) throw new Error(errors.slice(0, 5).join('; '));
  const clean: HoursConfig = {
    locations: Object.fromEntries(Object.entries(cfg.locations).map(([k, w]) => [k, normalizeWeek(w)])),
    brands: Object.fromEntries(Object.entries(cfg.brands).filter(([, w]) => w).map(([k, w]) => [k, normalizeWeek(w)])),
    holidays: cfg.holidays.map((h) => ({ ...h, name: h.name?.trim() || 'Holiday', locationCodes: h.locationCodes ?? [], slots: h.closed ? [] : normalizeSlots(h.slots ?? []) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    updatedAt: nowIso(),
  };
  await getRepo().setKv(KEY, clean);
  return clean;
}

function normalizeSlots(slots: Slot[]): Slot[] {
  return normalizeWeek({ monday: slots } as Partial<WeeklyHours>).monday;
}

/** Brand override wins; otherwise the location's hours; null = never set. */
export function effectiveHours(cfg: HoursConfig, brandName: string, locationCode: string): WeeklyHours | null {
  const week = cfg.brands[brandName] ?? cfg.locations[locationCode];
  return week ? normalizeWeek(week) : null;
}

export function localDate(ms: number, tz = foodhubTimeZone()): string {
  const p = localParts(ms, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function holidaysFor(cfg: HoursConfig, locationCode: string, fromDate: string, days = 90): Holiday[] {
  const end = new Date(Date.parse(`${fromDate}T12:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);
  return cfg.holidays.filter((h) => h.date >= fromDate && h.date <= end && (h.locationCodes.length === 0 || h.locationCodes.includes(locationCode)));
}

export async function publishContext(brandName: string, locationCode: string, cfg?: HoursConfig, now = Date.now()): Promise<PublishContext> {
  const hours = cfg ?? await getHours();
  const tz = foodhubTimeZone();
  const today = localDate(now, tz);
  return { hours: effectiveHours(hours, brandName, locationCode), holidays: holidaysFor(hours, locationCode, today), timezone: tz, today };
}

/** Day key of a local YYYY-MM-DD date. */
export function dayKeyOf(date: string): DayKey {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return DAYS[(dow + 6) % 7];
}

/** Open intervals (epoch ms) between from and to, honouring holidays. Used for "offline during open hours". */
export function openIntervals(week: WeeklyHours, holidays: Holiday[], fromMs: number, toMs: number, tz = foodhubTimeZone()): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let dayStart = startOfLocalDayMs(fromMs, tz); dayStart < toMs; dayStart = startOfLocalDayMs(dayStart + 36 * 3600_000, tz)) {
    const date = localDate(dayStart + 12 * 3600_000, tz);
    const holiday = holidays.find((h) => h.date === date);
    const slots = holiday ? (holiday.closed ? [] : holiday.slots ?? []) : week[dayKeyOf(date)] ?? [];
    for (const s of slots) {
      const a = Math.max(fromMs, dayStart + toMin(s.open) * 60_000);
      const b = Math.min(toMs, dayStart + toMin(s.close) * 60_000 + 60_000);
      if (b > a) out.push([a, b]);
    }
  }
  return out;
}

export function isOpenAt(week: WeeklyHours | null, holidays: Holiday[], ms: number, tz = foodhubTimeZone()): boolean {
  if (!week) return true;
  return openIntervals(week, holidays, ms, ms + 1, tz).length > 0;
}
