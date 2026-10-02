import { uberConnectSession } from '@/lib/food-hub/adapters/uber-provision';
import { withPerm } from '@/lib/food-hub/auth';
import { fail, ok } from '@/lib/food-hub/http';

export const dynamic = 'force-dynamic';

export const GET = withPerm('stores:map', async (req) => {
  const s = await uberConnectSession(new URL(req.url).searchParams.get('id') || '');
  if (!s) return fail('This Uber connection expired. Click “Connect Uber Eats stores” again.', 404);
  return ok(s);
});
