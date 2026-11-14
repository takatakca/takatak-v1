// Scheduled menu publishes (Atlas "Scheduled Publish"): pick locations/platforms + date/time;
// Food Hub publishes at that time (sync engine / cron) and logs the result. Can be cancelled.
import crypto from 'node:crypto';
import { logActivity, SCHEDULE_ACTOR, type Actor } from '../activity';
import { publishMenu } from '../ops';
import { getRepo } from '../repo';
import type { ChannelKey } from '../types';

export interface ScheduledPublish {
  id: string;
  brand: string;
  storeIds?: string[];
  channels?: ChannelKey[];
  at: string;
  createdBy: string;
  createdAt: string;
  status: 'scheduled' | 'done' | 'failed' | 'cancelled';
  result?: string;
}

const KEY = 'scheduled_publishes';

export async function listScheduled(brand?: string): Promise<ScheduledPublish[]> {
  const all = (await getRepo().getKv<ScheduledPublish[]>(KEY).catch(() => null)) ?? [];
  return all.filter((s) => !brand || s.brand === brand).sort((a, b) => a.at.localeCompare(b.at));
}

async function saveAll(list: ScheduledPublish[]) {
  // Keep the last 200 entries.
  await getRepo().setKv(KEY, list.slice(-200));
}

export async function schedulePublish(input: { brand: string; storeIds?: string[]; channels?: ChannelKey[]; at: string }, actor: Actor): Promise<ScheduledPublish> {
  const when = Date.parse(input.at);
  if (!Number.isFinite(when) || when < Date.now() + 60_000) throw new Error('Pick a date and time at least one minute in the future.');
  const entry: ScheduledPublish = { id: crypto.randomUUID(), brand: input.brand, storeIds: input.storeIds, channels: input.channels, at: new Date(when).toISOString(), createdBy: actor.name, createdAt: new Date().toISOString(), status: 'scheduled' };
  const all = (await getRepo().getKv<ScheduledPublish[]>(KEY)) ?? [];
  await saveAll([...all, entry]);
  await logActivity({ actor: actor.name, source: actor.source, kind: 'menu_publish', action: 'schedule_publish', status: 'queued', brandName: input.brand, summary: `Menu publish for ${input.brand} scheduled at ${new Date(when).toLocaleString('fr-CA')}` });
  return entry;
}

export async function cancelScheduled(id: string, actor: Actor): Promise<boolean> {
  const all = (await getRepo().getKv<ScheduledPublish[]>(KEY)) ?? [];
  const e = all.find((x) => x.id === id && x.status === 'scheduled');
  if (!e) return false;
  e.status = 'cancelled';
  await saveAll(all);
  await logActivity({ actor: actor.name, source: actor.source, kind: 'menu_publish', action: 'cancel_scheduled_publish', status: 'info', brandName: e.brand, summary: `Scheduled menu publish for ${e.brand} cancelled` });
  return true;
}

/** Runs every due scheduled publish once. Called by the sync engine and the cron. */
export async function runDuePublishes(now = Date.now()): Promise<number> {
  const all = (await getRepo().getKv<ScheduledPublish[]>(KEY).catch(() => null)) ?? [];
  const due = all.filter((x) => x.status === 'scheduled' && Date.parse(x.at) <= now);
  if (!due.length) return 0;
  // Mark first so two concurrent syncs cannot both publish.
  for (const d of due) d.status = 'done';
  await saveAll(all);
  for (const d of due) {
    try {
      const rows = await publishMenu(d.brand, { storeIds: d.storeIds, channels: d.channels, actor: { ...SCHEDULE_ACTOR, name: `Scheduled by ${d.createdBy}` } });
      d.result = `${rows.filter((r) => r.result.ok).length}/${rows.length} stores updated`;
      if (rows.some((r) => !r.result.ok)) d.status = 'failed';
    } catch (error) {
      d.status = 'failed';
      d.result = error instanceof Error ? error.message : String(error);
    }
  }
  await saveAll(all);
  return due.length;
}
