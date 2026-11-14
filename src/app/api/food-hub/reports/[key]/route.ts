import { NextResponse } from 'next/server';
import { withPerm } from '@/lib/food-hub/auth';
import { fail, ok } from '@/lib/food-hub/http';
import { parseFilters, parseRange } from '@/lib/food-hub/report-filter';
import { buildReport, renderReport, REPORTS, type ReportKey } from '@/lib/food-hub/reports';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ key: string }> };

// GET /api/food-hub/reports/order_transactions?from=2026-10-01&to=2026-10-01&format=csv|xlsx|json
export const GET = withPerm<Ctx>('analytics:view', async (req, context, actor) => {
  const { key } = await context.params;
  if (!(key in REPORTS)) return fail('Unknown report', 404);
  const q = new URL(req.url).searchParams;
  const table = await buildReport(key as ReportKey, { ...parseRange(q), ...parseFilters(q, actor) });
  const format = q.get('format') || 'csv';
  if (format === 'json') return ok({ title: table.title, columns: table.columns, rows: table.rows.slice(0, Number(q.get('limit') || 50)), total: table.rows.length, filename: table.filename });
  const file = renderReport(table, format === 'xlsx' ? 'xlsx' : 'csv');
  return new NextResponse(file.body as BodyInit, { headers: { 'Content-Type': file.contentType, 'Content-Disposition': `attachment; filename="${file.filename}"`, 'Cache-Control': 'no-store' } });
});
