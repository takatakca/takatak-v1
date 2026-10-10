import Link from "next/link";
import { GrowthKpi } from "@/components/growth/growth-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCad, type AdsSummary } from "@/lib/growth/ads-summary";

export function AdsSummaryCard({ summary }: { summary: AdsSummary | null }) {
  return (
    <Card>
      <CardHeader
        title="TAKATAK ADS — live results"
        subtitle="Real numbers from the active workspace. No simulated figures."
        action={
          <Link href="/dashboard/advertising" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
            Open →
          </Link>
        }
      />
      <CardBody>
        {summary ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <GrowthKpi label="Campaigns" value={String(summary.campaigns)} />
            <GrowthKpi label="Spent" value={formatCad(summary.spentCents)} hint={`of ${formatCad(summary.budgetCents)}`} />
            <GrowthKpi label="Impressions" value={summary.impressions.toLocaleString("en-CA")} />
            <GrowthKpi label="Clicks" value={summary.clicks.toLocaleString("en-CA")} />
            <GrowthKpi
              label="CTR"
              value={summary.impressions ? `${((summary.clicks / summary.impressions) * 100).toFixed(2)}%` : "—"}
            />
            <GrowthKpi label="Verified leads" value={summary.leads.toLocaleString("en-CA")} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Select a client workspace with TAKATAK ADS access to see live campaign results here.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
