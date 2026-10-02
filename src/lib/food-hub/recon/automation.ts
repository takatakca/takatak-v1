// Reconciliation automation: run after every statement import, once a day from the sync engine,
// and when Uber delivers a requested report.
import { logActivity, type Actor } from '../activity';
import { reportDownloadLinks, requestUberReport } from '../adapters/uber-eats';
import { nowIso, timedFetch } from '../config';
import { localDate } from '../hours';
import { getRepo } from '../repo';
import { startOfLocalDayMs } from '../time';
import { COL, importStatement, reconcile, syncCases } from './engine';

const DAY = 86400_000;
export const UBER_REQUESTS = 'uber_report_requests';
const PLATFORM: Actor = { username: 'uber', name: 'Uber Eats Reporting API', source: 'platform' };

/** Re-checks the last `days` days and opens/closes dispute cases. */
export async function refreshCases(days = 90, actor?: Actor) {
  const to = startOfLocalDayMs(Date.now() + DAY);
  const from = startOfLocalDayMs(to - days * DAY);
  const result = await reconcile({ from: new Date(from).toISOString(), to: new Date(to).toISOString() });
  return syncCases(result, actor);
}

/** Once a day (sync engine): refresh cases so new "missing from payout" orders surface without anyone looking. */
export async function dailyReconciliation(now = Date.now()): Promise<{ opened: number; closed: number } | null> {
  const repo = getRepo();
  const today = localDate(now);
  if ((await repo.getKv<string>('recon_daily_run').catch(() => null)) === today) return null;
  await repo.setKv('recon_daily_run', today);
  if (!(await repo.listDocs(COL.imports, { limit: 1 })).length) return { opened: 0, closed: 0 };
  return refreshCases();
}

export interface UberReportRequest { id: string; workflowId: string | null; from: string; to: string; status: 'requested' | 'imported' | 'failed'; message: string; requestedBy: string; at: string }

export async function requestUberPaymentReport(from: string, to: string, actor: Actor): Promise<UberReportRequest> {
  const repo = getRepo();
  const stores = (await repo.listStores('uber_eats')).map((s) => s.channelStoreId);
  const r = await requestUberReport([...new Set(stores)], from, to, 'PAYMENT_DETAILS_REPORT');
  const doc: UberReportRequest = { id: r.workflowId ?? `req-${Date.now()}`, workflowId: r.workflowId ?? null, from, to, status: r.ok ? 'requested' : 'failed', message: r.message, requestedBy: actor.name, at: nowIso() };
  await repo.putDocs(UBER_REQUESTS, [{ id: doc.id, at: doc.at, data: doc }]);
  await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: 'uber_report_request', status: r.ok ? 'queued' : 'failed', channel: 'uber_eats', summary: `Uber Eats payment report ${from} → ${to}: ${r.message}` });
  return doc;
}

/** Uber "eats.report.success" webhook: download every CSV it links to and import it. */
export async function handleUberReportWebhook(body: any): Promise<{ imported: number; errors: string[] }> {
  const repo = getRepo();
  const links = reportDownloadLinks(body);
  const errors: string[] = [];
  let imported = 0;
  for (const url of links) {
    try {
      const res = await timedFetch(url, {});
      if (!res.ok) throw new Error(`download HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || `uber-report-${localDate(Date.now())}.csv`;
      const out = await importStatement({ fileName: name, bytes, channel: 'uber_eats', actor: PLATFORM, source: 'uber_reporting_api' });
      if (out.ok) imported++;
      else errors.push(`${name}: not a payment details report — import it from Statement imports and confirm the columns`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  const workflowId = String(body?.workflow_id ?? body?.report_metadata?.workflow_id ?? body?.meta?.workflow_id ?? body?.meta?.resource_id ?? '');
  if (workflowId) {
    const req = await repo.getDoc<UberReportRequest>(UBER_REQUESTS, workflowId);
    if (req) await repo.putDocs(UBER_REQUESTS, [{ id: req.id, at: req.at, data: { ...req.data, status: imported ? 'imported' : 'failed', message: imported ? `${imported} file(s) imported` : errors.join('; ') || 'No download link in the webhook' } }]);
  }
  if (!links.length) errors.push('The report webhook had no download link.');
  if (imported) await refreshCases(90, PLATFORM);
  if (errors.length) await logActivity({ actor: PLATFORM.name, source: 'platform', kind: 'settings', action: 'uber_report_import', status: imported ? 'info' : 'failed', channel: 'uber_eats', summary: `Uber report webhook: ${imported} file(s) imported${errors.length ? ` — ${errors.join('; ')}` : ''}` });
  return { imported, errors };
}
