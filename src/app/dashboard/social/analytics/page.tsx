import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { SocialEmptyState } from '@/components/social/social-empty-state';
import { SocialHeader } from '@/components/social/social-header';
import { SourceBanner } from '@/components/social/source-banner';
import { getSocialShellBilling } from '@/lib/billing/social/billing-banner';
import { SOCIAL_BILLING_HREF } from '@/lib/billing/social/billing-banner-policy';
import { requireWorkspacePermission } from '@/lib/security/workspace-guard';
import { getSocialAnalyticsData } from '@/lib/social/social-data';

export const dynamic = 'force-dynamic';

const TOTAL_LABELS: Record<string, string> = {
  reach: 'portée · reach',
  impressions: 'impressions',
  engagement: 'engagement',
  clicks: 'clics · clicks',
  followers: 'abonnés · followers',
};

export default async function SocialAnalyticsPage() {
  const access = await requireWorkspacePermission(
    'view_social',
    '/dashboard/social/analytics',
  );
  const [data, billing] = await Promise.all([
    getSocialAnalyticsData(),
    getSocialShellBilling(access.activeClientId),
  ]);
  const a = data.analytics;
  const historyDays = billing?.analyticsHistoryDays ?? 0;
  return (
    <div className="space-y-5">
      <SocialHeader
        title="Statistiques sociales · Social Analytics"
        subtitle="Portée, impressions, engagement, clics et abonnés de vos comptes branchés ; seuls les vrais chiffres de vos comptes paraissent ici · Only real numbers from your accounts are shown."
      />
      {historyDays !== null ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          L’offre gratuite comprend {historyDays} jours d’historique · Free includes {historyDays} days of history.{' '}
          <Link
            href={SOCIAL_BILLING_HREF}
            className="font-medium text-[#2a1728] underline-offset-2 hover:underline"
          >
            Starter ouvre tout l’historique · Starter unlocks the full window
          </Link>
          .
        </p>
      ) : null}
      <SourceBanner source={data.source} label={data.sourceLabel} />
      {a.hasData ? (
        <Card>
          <CardHeader
            title="Totaux · Totals"
            subtitle={`${a.days} jour${a.days === 1 ? '' : 's'} de données · day records`}
            action={
              a.source === 'internal_mock' ? (
                <Badge tone="muted">Exemple (démo locale) · Sample (local demo)</Badge>
              ) : null
            }
          />
          <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(a.totals).map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-center"
              >
                <p className="text-lg font-semibold text-slate-900">{v}</p>
                <p className="text-[11px] capitalize text-slate-400">{TOTAL_LABELS[k] ?? k}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : (
        <SocialEmptyState
          icon={BarChart3}
          title="Aucune statistique pour l’instant · No analytics yet"
          description="Les chiffres paraissent dès que vos comptes sociaux sont branchés ; branchez-les dans Réseaux sociaux ou écrivez à l’équipe · Numbers appear once your accounts are connected."
        />
      )}
    </div>
  );
}
