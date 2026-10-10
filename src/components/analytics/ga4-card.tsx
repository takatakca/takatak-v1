import { GrowthKpi } from "@/components/growth/growth-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { GoogleResult } from "@/lib/integrations/google/client";
import type { Ga4Summary } from "@/lib/integrations/google/parse";

import { DailyChart } from "./daily-chart";

export function Ga4Card({ siteName, days, result }: { siteName: string; days: number; result: GoogleResult<Ga4Summary> }) {
  return (
    <Card>
      <CardHeader title={`Google Analytics 4 — ${siteName}`} subtitle={`Last ${days} days, live from the GA4 Data API`} />
      <CardBody>
        {result.ok ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <GrowthKpi label="Sessions" value={result.data.totals.sessions.toLocaleString("en-CA")} />
              <GrowthKpi label="Active users (daily sum)" value={result.data.totals.users.toLocaleString("en-CA")} />
              <GrowthKpi label="Page views" value={result.data.totals.pageViews.toLocaleString("en-CA")} />
            </div>
            <DailyChart data={result.data.daily.map((d) => ({ day: d.date, value: d.sessions }))} label="Sessions" />
          </div>
        ) : (
          <p className="text-sm text-slate-500">GA4 data is unavailable ({result.reason.replace(/_/g, " ")}). Nothing is estimated.</p>
        )}
      </CardBody>
    </Card>
  );
}
