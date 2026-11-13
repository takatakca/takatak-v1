// Seasonal TAKATAK campaigns, computed for every year from the retail calendar
// big Canadian and US stores follow (New Year sales, Valentine's Day, Easter,
// Mother's and Father's Day, Québec and Canada Day, summer sales, back to
// school, Thanksgiving, Halloween, Black Friday, Cyber Monday, the holidays,
// Boxing Day). Nobody has to add them by hand: each code exists only between
// its start and end (Montréal time), so a countdown on the site is always true.
// Owner's rule: 5, 7 or 10 % per campaign; annual prepayment is 15 % (catalog.ts).

export type Bi = { fr: string; en: string };

export interface SeasonalCampaign {
  key: string;
  code: string;
  percentOff: 5 | 7 | 10;
  title: Bi;
  startsAt: string;
  endsAt: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** n-th weekday (0 = Sunday) of a month, 1-based month; n = -1 for the last one. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay();
  return lastDay - ((last - weekday + 7) % 7);
}

/** Eastern daylight time: second Sunday of March 2 a.m. to first Sunday of November 2 a.m. */
function isEasternDst(year: number, month: number, day: number): boolean {
  const start = nthWeekday(year, 3, 0, 2);
  const end = nthWeekday(year, 11, 0, 1);
  if (month < 3 || month > 11) return false;
  if (month > 3 && month < 11) return true;
  if (month === 3) return day >= start;
  return day < end;
}

/** ISO date-time in Montréal time, with the right offset for that day. */
export function montreal(year: number, month: number, day: number, end = false): string {
  // Roll over month/year overflow (e.g. Black Friday + 3 days).
  const d = new Date(Date.UTC(year, month - 1, day));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const dd = d.getUTCDate();
  const offset = isEasternDst(y, m, dd) ? "-04:00" : "-05:00";
  return `${y}-${pad(m)}-${pad(dd)}T${end ? "23:59:59" : "00:00:00"}${offset}`;
}

/** Easter Sunday (Gregorian), month and day. */
export function easter(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

type Def = { key: string; prefix: string; percentOff: 5 | 7 | 10; title: Bi; window: (y: number) => [number, number, number, number] };

/** [startMonth, startDay, endMonth, endDay] for each campaign, per year. */
const DEFS: Def[] = [
  { key: "new-year", prefix: "NOUVELAN", percentOff: 7, title: { fr: "Soldes du Nouvel An", en: "New Year sale" }, window: () => [1, 2, 1, 15] },
  { key: "valentine", prefix: "VALENTIN", percentOff: 5, title: { fr: "Saint-Valentin", en: "Valentine's Day" }, window: () => [2, 7, 2, 14] },
  {
    key: "easter",
    prefix: "PAQUES",
    percentOff: 5,
    title: { fr: "Pâques", en: "Easter" },
    window: (y) => {
      const e = easter(y);
      return [e.month, e.day - 7, e.month, e.day + 1];
    },
  },
  { key: "mothers-day", prefix: "MERES", percentOff: 5, title: { fr: "Fête des Mères", en: "Mother's Day" }, window: (y) => { const d = nthWeekday(y, 5, 0, 2); return [5, d - 7, 5, d]; } },
  { key: "fathers-day", prefix: "PERES", percentOff: 5, title: { fr: "Fête des Pères", en: "Father's Day" }, window: (y) => { const d = nthWeekday(y, 6, 0, 3); return [6, d - 7, 6, d]; } },
  { key: "june-holidays", prefix: "FETEJUIN", percentOff: 7, title: { fr: "Fête nationale et fête du Canada", en: "Québec and Canada Day" }, window: () => [6, 20, 7, 2] },
  { key: "summer-sale", prefix: "ETE", percentOff: 7, title: { fr: "Soldes d’été", en: "Summer sale" }, window: () => [7, 8, 7, 15] },
  { key: "back-to-business", prefix: "RENTREE", percentOff: 7, title: { fr: "La rentrée", en: "Back to business" }, window: () => [8, 25, 9, 8] },
  { key: "thanksgiving", prefix: "MERCI", percentOff: 5, title: { fr: "Action de grâce", en: "Thanksgiving" }, window: (y) => { const d = nthWeekday(y, 10, 1, 2); return [10, d - 6, 10, d]; } },
  { key: "halloween", prefix: "HALLOWEEN", percentOff: 5, title: { fr: "Halloween", en: "Halloween" }, window: () => [10, 25, 10, 31] },
  {
    key: "black-friday",
    prefix: "BF",
    percentOff: 10,
    title: { fr: "Black Friday", en: "Black Friday" },
    // US Thanksgiving is the 4th Thursday of November; Black Friday week ends the day after.
    window: (y) => { const f = nthWeekday(y, 11, 4, 4) + 1; return [11, f - 4, 11, f]; },
  },
  { key: "cyber-monday", prefix: "CYBER", percentOff: 10, title: { fr: "Cyber lundi", en: "Cyber Monday" }, window: (y) => { const f = nthWeekday(y, 11, 4, 4) + 1; return [11, f + 1, 11, f + 3]; } },
  { key: "holidays", prefix: "FETES", percentOff: 7, title: { fr: "Les Fêtes", en: "The holidays" }, window: () => [12, 8, 12, 24] },
  { key: "boxing-day", prefix: "BOXING", percentOff: 10, title: { fr: "Boxing Day", en: "Boxing Day" }, window: () => [12, 26, 12, 31] },
];

/** Every seasonal campaign of one year. */
export function seasonalCampaigns(year: number): SeasonalCampaign[] {
  return DEFS.map((d) => {
    const [sm, sd, em, ed] = d.window(year);
    return {
      key: d.key,
      code: `${d.prefix}${year}`,
      percentOff: d.percentOff,
      title: d.title,
      startsAt: montreal(year, sm, sd),
      endsAt: montreal(year, em, ed, true),
    };
  });
}

/** Campaigns of last year, this year and next year (enough for any date). */
export function seasonalAround(now: Date): SeasonalCampaign[] {
  const y = now.getUTCFullYear();
  return [...seasonalCampaigns(y - 1), ...seasonalCampaigns(y), ...seasonalCampaigns(y + 1)];
}
