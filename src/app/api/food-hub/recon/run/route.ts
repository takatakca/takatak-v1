import { ok } from '@/lib/food-hub/http';
import { refreshCases } from '@/lib/food-hub/recon/automation';
import { withFinance } from '@/lib/food-hub/recon/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Re-check the last 90 days now: opens cases for new problems, closes the ones later payouts fixed.
export const POST = withFinance('finance:edit', async (_req, _ctx, actor) => ok({ ...(await refreshCases(90, actor)) }));
