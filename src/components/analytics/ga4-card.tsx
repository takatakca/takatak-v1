import { GrowthKpi } from "@/components/growth/growth-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { GoogleResult } from "@/lib/integrations/google/client";
import type { Ga4Summary } from "@/lib/integrations/google/parse";

import { DailyChart } from "./daily-chart";

export function Ga4Card({ siteName, days, result }: { siteName: string; days: number; result: GoogleResult<Ga4Summary> }) {
  return (
    <Card>
      <CardHeader title={`Google Analytics 4 — ${siteName}`} subtitle={`${days} derniers jours, en direct de Google Analytics · Last ${days} days, live from GA4`} />
      <CardBody>
        {result.ok ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <GrowthKpi label="Sessions" value={result.data.totals.sessions.toLocaleString("fr-CA")} />
              <GrowthKpi label="Utilisateurs actifs (somme par jour) · Active users" value={result.data.totals.users.toLocaleString("fr-CA")} />
              <GrowthKpi label="Pages vues · Page views" value={result.data.totals.pageViews.toLocaleString("fr-CA")} />
            </div>
            <DailyChart data={result.data.daily.map((d) => ({ day: d.date, value: d.sessions }))} label="Sessions" />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Données GA4 indisponibles ({result.reason.replace(/_/g, " ")}) ; rien n’est estimé · GA4 data is unavailable; nothing is estimated.</p>
        )}
      </CardBody>
    </Card>
  );
}
