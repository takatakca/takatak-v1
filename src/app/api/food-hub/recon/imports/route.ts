import { isChannelKey } from '@/lib/food-hub/adapters';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { refreshCases } from '@/lib/food-hub/recon/automation';
import { COL, deleteImport, importStatement, type StatementImport } from '@/lib/food-hub/recon/engine';
import { withFinance } from '@/lib/food-hub/recon/http';
import { FIELD_LABELS, type ColumnMapping } from '@/lib/food-hub/recon/statements';
import { getRepo } from '@/lib/food-hub/repo';
import type { ChannelKey } from '@/lib/food-hub/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = withFinance('analytics:view', async () => ok({
  imports: (await getRepo().listDocs<StatementImport>(COL.imports, {})).map((d) => d.data),
  fields: FIELD_LABELS,
}));

// { fileName, contentBase64, channel?, mapping? } — CSV or .xlsx exported from the platform portal.
export const POST = withFinance('finance:edit', async (req, _ctx, actor) => {
  const b = await readJson(req);
  if (!b.fileName || !b.contentBase64) return fail('Choose a CSV or Excel file.');
  const bytes = new Uint8Array(Buffer.from(String(b.contentBase64), 'base64'));
  if (bytes.length > 15 * 1024 * 1024) return fail('File too large (max 15 MB).');
  const channel = b.channel && isChannelKey(String(b.channel)) ? (String(b.channel) as ChannelKey) : null;
  const mapping = b.mapping && typeof b.mapping === 'object' ? (b.mapping as ColumnMapping) : undefined;
  const out = await importStatement({ fileName: String(b.fileName), bytes, channel, mapping, actor });
  // Columns to confirm is a normal answer (HTTP 200, ok: true), not an error.
  if (!out.ok) { const { ok: _imported, ...ask } = out; return ok({ ...ask, imported: false }); }
  const cases = await refreshCases(90, actor);
  return ok({ imported: true, import: out.import, cases });
});

export const DELETE = withFinance('finance:edit', async (req, _ctx, actor) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id || !(await deleteImport(id, actor))) return fail('Import not found', 404);
  await refreshCases(90, actor);
  return ok();
});
