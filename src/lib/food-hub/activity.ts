// Activity log (Atlas "Store Action Report"): who did what, when, where, from where, and whether it worked.
// Logging never breaks the action being logged.
import { nowIso } from './config';
import { getRepo } from './repo';
import type { ActivityEntry, ChannelResult } from './types';

export const AUTOMATION = 'TAKATAK automation';

export async function logActivity(entry: Omit<ActivityEntry, 'at'> & { at?: string }): Promise<void> {
  try {
    await getRepo().addActivity({ ...entry, at: entry.at ?? nowIso() });
  } catch (error) {
    console.error('[foodhub] activity log failed:', error);
  }
}

export function resultStatus(res: Pick<ChannelResult, 'ok' | 'status'>): ActivityEntry['status'] {
  if (res.status === 'queued') return 'queued';
  if (res.status === 'skipped' || res.status === 'blocked') return res.status === 'blocked' ? 'failed' : 'info';
  return res.ok ? 'success' : 'failed';
}

/** Who triggered an action — a signed-in person, the automation, a schedule or a platform. */
export interface Actor {
  username: string;
  name: string;
  source: ActivityEntry['source'];
}

export const SYSTEM_ACTOR: Actor = { username: 'system', name: AUTOMATION, source: 'automation' };
export const SCHEDULE_ACTOR: Actor = { username: 'schedule', name: 'Scheduled task', source: 'schedule' };
