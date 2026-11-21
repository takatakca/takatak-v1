import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import { Ga4Card } from "@/components/analytics/ga4-card";
import { fetchGa4Daily, googleServiceAccountConfigured, googleServiceAccountEmail } from "@/lib/integrations/google/client";
import { AdsSummaryCard } from "@/components/growth/ads-summary-card";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getActiveWorkspaceAdsSummary } from "@/lib/growth/ads-summary";
import { getAnalyticsSummary, type AnalyticsSummary } from "@/lib/analytics/service";
import { publicAppOrigin } from "@/lib/growth/public-origin";
import { getConnectorStatuses } from "@/lib/growth/status";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export const dynamic = "force-dynamic";

const UNIFIED_METRICS = [
  { name: "Trafic du site · Website traffic", detail: "Visiteurs, sessions et pages les plus vues · Visitors, sessions and top pages", source: "GA4" },
  { name: "Sources de trafic · Traffic sources", detail: "Recherche, réseaux sociaux, annonces, accès direct et référents · Search, social, ads, direct, referral", source: "GA4" },
  { name: "Recherche naturelle · Organic search", detail: "Requêtes, impressions, clics et position moyenne · Queries, impressions, clicks, average position", source: "Search Console" },
  { name: "Conversions", detail: "Appels, formulaires, réservations et achats · Calls, forms, bookings and purchases", source: "GA4 + Meta CAPI" },
  { name: "Performance payante · Paid performance", detail: "Dépenses, CPC, coût par prospect et rendement sur chaque réseau · Spend, CPC, CPL and ROAS", source: "Connecteurs publicitaires · Ads connectors" },
  { name: "Croissance sociale · Social growth", detail: "Abonnés, portée et engagement · Followers, reach and engagement", source: "Module Social" },
  { name: "Réputation · Reputation", detail: "Note moyenne, rythme des avis et taux de réponse · Average rating, review velocity, response rate", source: "Connecteurs d’avis · Reviews connectors" },
  { name: "Pipeline de prospects · Lead pipeline", detail: "Nouveaux prospects par source et conversion en clients · New leads by source and conversion", source: "Module Prospects · Leads module" },
];

export default async function GrowthAnalyticsPage({ searchParams }: { searchParams: Promise<{ site?: string; days?: string }> }) {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/growth/analytics");
  const params = await searchParams;
  const scoped = access.mode === "client_scoped" && hasEffectivePermission(access, "view_reports");
  let summary: AnalyticsSummary | null = null;
  let unavailable = false;
  if (scoped) {
    try {
      summary = await getAnalyticsSummary(access.activeClientId, { siteId: params.site ?? null, days: Number(params.days) || 30 });
    } catch {
      unavailable = true;
      console.error("[analytics] summary unavailable");
    }
  }
  const origin = await publicAppOrigin();
  const ga4Site = summary
    ? (summary.sites.find((x) => x.id === summary!.selectedSiteId && x.ga4PropertyId) ?? summary.sites.find((x) => x.ga4PropertyId) ?? null)
    : null;
  const ga4 = ga4Site && googleServiceAccountConfigured() ? await fetchGa4Daily(ga4Site.ga4PropertyId!, summary!.days) : null;
  const ads = await getActiveWorkspaceAdsSummary(access);
  const connectors = getConnectorStatuses().filter((c) => c.category === "analytics");

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Statistiques · Analytics"
        description="TAKATAK Analytics (sans témoins, vos propres données) avec les annonces, la recherche, les réseaux, les avis et les prospects dans un seul tableau · Cookie-free first-party analytics plus ads, search, social, reviews and leads in one scoreboard."
        badges={[{ label: "TAKATAK Analytics en marche · live", tone: "success" }]}
      />

      {summary ? (
        <>
          <AnalyticsPanel
            data={summary}
            canManage={access.mode === "client_scoped" && hasEffectivePermission(access, "manage_services")}
            origin={origin}
            googleEmail={googleServiceAccountEmail()}
          />
          {ga4 && ga4Site ? <Ga4Card siteName={ga4Site.name} days={summary.days} result={ga4} /> : null}
        </>
      ) : (
        <HonestyNote>
          {unavailable
            ? "La base d’analytique est injoignable pour le moment : les chiffres du site sont masqués plutôt qu’inventés · The analytics database is not reachable right now; numbers are hidden rather than guessed."
            : "Choisissez un espace client pour ajouter ses sites, installer TAKATAK Analytics et voir le trafic en direct · Select a client workspace to add its websites and see live traffic."}
        </HonestyNote>
      )}

      <AdsSummaryCard summary={ads} />

      <Card>
        <CardHeader
          title="Tableau unifié · Unified scoreboard"
          subtitle="Chaque mesure se remplit dès que sa source est branchée · Each metric fills in as its source is connected."
        />
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {UNIFIED_METRICS.map((m) => (
            <div key={m.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">{m.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{m.detail}</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Source : {m.source}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Connecteurs de mesure · Tracking &amp; analytics connectors</h2>
        <ConnectorGrid connectors={connectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>
          Les chiffres du site et de la recherche n’apparaissent qu’une fois que GA4 ou Search Console renvoie de vraies données ; rien n’est estimé ·
          Website and search numbers appear only after GA4 or Search Console returns real data. Nothing is estimated.
        </HonestyNote>
      </section>
    </div>
  );
}
