import { inScope, withPerm } from '@/lib/food-hub/auth';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { allowedActions, ORDER_ACTIONS, runOrderAction, type OrderAction } from '@/lib/food-hub/pipeline';
import { getRepo } from '@/lib/food-hub/repo';
import { CANCEL_REASON_LABELS, type CancelReason } from '@/lib/food-hub/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = withPerm<Ctx>('view', async (_req, context, actor) => {
  const { id } = await context.params;
  const repo = getRepo();
  const order = await repo.getOrder(id);
  if (!order || !inScope(actor, order.locationCode)) return fail('Order not found', 404);
  return ok({ order, events: await repo.listEvents(id), actions: allowedActions(order), reasons: CANCEL_REASON_LABELS });
});

export const POST = withPerm<Ctx>('orders:act', async (req, context, actor) => {
  const { id } = await context.params;
  const body = await readJson(req);
  const action = String(body.action || '') as OrderAction;
  if (!ORDER_ACTIONS.includes(action)) return fail(`action must be one of: ${ORDER_ACTIONS.join(', ')}`);
  const existing = await getRepo().getOrder(id);
  if (!existing || !inScope(actor, existing.locationCode)) return fail('Order not found', 404);
  const reasonCode = body.reasonCode && body.reasonCode in CANCEL_REASON_LABELS ? (body.reasonCode as CancelReason) : undefined;
  const missing = Array.isArray(body.missing) ? body.missing.map((m: any) => ({ line: Number(m.line), quantity: Number(m.quantity) })).filter((m: any) => Number.isInteger(m.line) && m.quantity > 0) : undefined;
  const { order, result } = await runOrderAction(id, action, { reason: body.reason ? String(body.reason) : undefined, reasonCode, actor, missing });
  if (!order) return fail(result.message, 404);
  return ok({ order, result, actions: allowedActions(order) });
});
