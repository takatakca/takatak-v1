import { activateFoodHub } from '@/lib/food-hub/access';
import { logActivity } from '@/lib/food-hub/activity';
import { fail, ok } from '@/lib/food-hub/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One-time: makes the current TAKATAK workspace the Food Hub workspace.
export async function POST() {
  try {
    const result = await activateFoodHub();
    if (!result.ok) return fail(result.message, result.status);
    await logActivity({ actor: 'TAKATAK owner', source: 'dashboard', kind: 'settings', action: 'activate', status: 'success', summary: 'Food Hub activated for this TAKATAK workspace' });
    return ok({ clientId: result.clientId });
  } catch (error) {
    console.error('[food-hub] activation failed:', error instanceof Error ? error.message : error);
    return fail('Activation failed. Check that the database migration has been applied.', 500);
  }
}
