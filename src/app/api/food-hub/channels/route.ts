import { ADAPTERS, CHANNEL_KEYS } from '@/lib/food-hub/adapters';
import { liveConnectorsGloballyEnabled, publicBaseUrl } from '@/lib/food-hub/config';
import { withPerm } from '@/lib/food-hub/auth';
import { ok } from '@/lib/food-hub/http';
import { can } from '@/lib/food-hub/session';
import { VERIFY_KEY, cloverInventorySyncEnabled } from '@/lib/food-hub/clover-sync';
import { cloverReadiness } from '@/lib/food-hub/pos/clover';
import { cloverOrderTypesEnabled, cloverRecordPaymentEnabled } from '@/lib/food-hub/pos/clover-books';
import { getRepo } from '@/lib/food-hub/repo';

export const dynamic = 'force-dynamic';

// Behind sign-in. Only the owner (admin) can use `?reveal=1`, which returns the webhook secrets that
// npm run food-hub:setup generated, so the owner can hand them to each platform from this screen.
// Platform API keys (Uber secret, DoorDash signing secret, JET API key, Clover token) are NEVER returned.
export const GET = withPerm('stores:map', async (req, _ctx, actor) => {
  const url = new URL(req.url);
  // Without a dashboard password, secrets are only revealed to a browser on this same machine.
  const reveal = url.searchParams.get('reveal') === '1' && can(actor.role, 'admin');
  const repo = getRepo();
  const base = publicBaseUrl();
  const channels = CHANNEL_KEYS.map((k) => {
    const r = ADAPTERS[k].readiness();
    return {
      ...r,
      webhookUrl: `${base}${r.webhookPath}`,
      extraWebhooks: (r.extraWebhooks ?? []).map((w) => ({ label: w.label, url: `${base}${w.path}` })),
      handoff: (r.handoff ?? []).map((h) => ({ label: h.label, envKey: h.envKey, set: Boolean(process.env[h.envKey]), value: reveal ? process.env[h.envKey] || '' : undefined })),
    };
  });
  const jobs = await repo.listJobs(40);
  return ok({
    mode: repo.mode,
    publicUrl: base,
    liveEnabled: liveConnectorsGloballyEnabled(),
    dashboardProtected: true,
    clover: {
      ...cloverReadiness(),
      webhookUrl: `${base}/api/food-hub/webhooks/clover`,
      webhookAuthSet: Boolean(process.env.CLOVER_WEBHOOK_AUTH),
      // The verification code is not a secret (Clover shows it to you too); only shown to owners.
      verification: can(actor.role, 'admin') ? await repo.getKv<{ code: string; at: string }>(VERIFY_KEY).catch(() => null) : null,
      recordPayments: cloverRecordPaymentEnabled(),
      orderTypes: cloverOrderTypesEnabled(),
      inventorySync: cloverInventorySyncEnabled(),
    },
    channels,
    jobs: jobs.filter((j) => j.kind !== 'webhook_unparsed'),
    unparsed: jobs.filter((j) => j.kind === 'webhook_unparsed'),
  });
});
