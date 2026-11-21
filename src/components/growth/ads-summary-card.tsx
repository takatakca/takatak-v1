import Link from "next/link";
import { GrowthKpi } from "@/components/growth/growth-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCad, type AdsSummary } from "@/lib/growth/ads-summary";

export function AdsSummaryCard({ summary }: { summary: AdsSummary | null }) {
  return (
    <Card>
      <CardHeader
        title="TAKATAK ADS — résultats en direct · live results"
        subtitle="Les vrais chiffres de votre espace, aucun chiffre simulé · Real numbers from your workspace, no simulated figures."
        action={
          <Link href="/dashboard/advertising" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
            Ouvrir · Open →
          </Link>
        }
      />
      <CardBody>
        {summary ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <GrowthKpi label="Campagnes · Campaigns" value={String(summary.campaigns)} />
            <GrowthKpi label="Dépensé · Spent" value={formatCad(summary.spentCents)} hint={`sur · of ${formatCad(summary.budgetCents)}`} />
            <GrowthKpi label="Impressions" value={summary.impressions.toLocaleString("fr-CA")} />
            <GrowthKpi label="Clics · Clicks" value={summary.clicks.toLocaleString("fr-CA")} />
            <GrowthKpi
              label="Taux de clics · CTR"
              value={summary.impressions ? `${((summary.clicks / summary.impressions) * 100).toFixed(2).replace(".", ",")} %` : "—"}
            />
            <GrowthKpi label="Prospects vérifiés · Verified leads" value={summary.leads.toLocaleString("fr-CA")} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Choisissez un espace client avec TAKATAK ADS pour voir ici les résultats en direct · Select a client workspace with TAKATAK ADS access.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
