// Kitchen prep time per location — Atlas "Normal" vs "Busy" prep time.
// Used as the ready-by target on every order, sent to DoorDash as prep_time on confirmation,
// and shown on the board. (Uber Eats and Skip have no API to receive a prep time.)
import { logActivity, type Actor } from './activity';
import { getRepo } from './repo';

export interface PrepSetting { normal: number; busy: number; isBusy: boolean; changedAt?: string; changedBy?: string }
const KEY = 'prep';
export const DEFAULT_PREP: PrepSetting = { normal: 15, busy: 25, isBusy: false };

export async function getPrepSettings(): Promise<Record<string, PrepSetting>> {
  return (await getRepo().getKv<Record<string, PrepSetting>>(KEY).catch(() => null)) ?? {};
}

export async function prepFor(locationCode?: string | null): Promise<PrepSetting & { minutes: number }> {
  const all = await getPrepSettings();
  const s = { ...DEFAULT_PREP, ...(locationCode ? all[locationCode] : undefined) };
  return { ...s, minutes: s.isBusy ? s.busy : s.normal };
}

export async function savePrep(locationCode: string, patch: Partial<PrepSetting>, actor: Actor): Promise<PrepSetting> {
  const all = await getPrepSettings();
  const current = { ...DEFAULT_PREP, ...all[locationCode] };
  const next: PrepSetting = {
    normal: clamp(patch.normal ?? current.normal),
    busy: clamp(patch.busy ?? current.busy),
    isBusy: patch.isBusy ?? current.isBusy,
    changedAt: new Date().toISOString(),
    changedBy: actor.name,
  };
  if (next.busy < next.normal) next.busy = next.normal;
  await getRepo().setKv(KEY, { ...all, [locationCode]: next });
  await logActivity({
    actor: actor.name, source: actor.source, kind: 'store_status', action: patch.isBusy === undefined ? 'prep_time' : next.isBusy ? 'busy_on' : 'busy_off', status: 'success', locationCode,
    summary: patch.isBusy === undefined ? `Prep time ${locationCode}: normal ${next.normal} min, busy ${next.busy} min` : `${locationCode} ${next.isBusy ? 'switched to BUSY' : 'back to normal'} — prep ${next.isBusy ? next.busy : next.normal} min`,
  });
  return next;
}

function clamp(n: number) { return Math.max(5, Math.min(120, Math.round(Number(n) || 15))); }
