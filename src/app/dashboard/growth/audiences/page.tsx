import Link from "next/link";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { listAudiencesWithReach } from "@/lib/analytics/service";
import { getConnectorStatusMap } from "@/lib/growth/status";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export const dynamic = "force-dynamic";

const RETARGETING = [
  { name: "Website visitors", detail: "Everyone who visited in the last 30/60/90 days.", needs: "TAKATAK Analytics (live) — sync needs Meta/Google/TikTok" },
  { name: "High-intent visitors", detail: "Viewed pricing, booking or contact pages but did not convert.", needs: "Pixel + conversion events" },
  { name: "Social engagers", detail: "People who liked, commented or messaged the brand pages.", needs: "Meta Ads" },
  { name: "Customer list", detail: "Hashed past customers for re-engagement or exclusion.", needs: "Leads module + Meta/Google Ads" },
  { name: "Lookalikes", detail: "New people who resemble the best customers.", needs: "Meta Ads or Google Ads" },
  { name: "Abandoned leads", detail: "Started a form or chat but never finished.", needs: "Web chat + pixel" },
];

const GEO = [
  { name: "Country, region and city", detail: "Serve ads only where the business operates.", live: true },
  { name: "Postal-code prefixes", detail: "Target specific neighbourhoods by FSA (e.g. H4G, H4H).", live: true },
  { name: "Language and device", detail: "French or English creatives; mobile or desktop placements.", live: true },
  { name: "Radius around the business", detail: "Ads within N km of each location on Google and Meta.", live: false },
  { name: "Competitor geofencing", detail: "Reach people near competitor locations.", live: false },
  { name: "Local grid insights", detail: "Pair map-pack rank grids with geo campaigns (QMAPS).", live: false },
];

export default async function AudiencesPage() {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/growth/audiences");
  let audiences: Awaited<ReturnType<typeof listAudiencesWithReach>> | null = null;
  if (access.mode === "client_scoped" && hasEffectivePermission(access, "view_reports")) {
    try {
      audiences = await listAudiencesWithReach(access.activeClientId);
    } catch {
      console.error("[analytics] audiences unavailable");
    }
  }
  const map = getConnectorStatusMap();
  const connectors = ["takatak_analytics", "meta_pixel", "gtm", "google_ads", "meta_ads", "tiktok_ads", "takatak_ads"].flatMap((k) => map.get(k) ?? []);

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Retargeting & Geo-targeting"
        description="Bring back people who already showed interest, and spend only in the neighbourhoods that matter to each business."
      />

      {audiences ? (
        <Card>
          <CardHeader
            title="Your audiences"
            subtitle="Built from TAKATAK Analytics visitors. Sync to Meta/Google turns on when those ad accounts are connected."
            action={<Link href="/dashboard/growth/analytics" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">Manage →</Link>}
          />
          <CardBody className="space-y-2">
            {audiences.length === 0 ? (
              <p className="text-sm text-slate-500">No audiences yet. Create one from Analytics once a website is collecting.</p>
            ) : (
              audiences.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-800">{a.name}</span>
                  <span className="text-slate-500">{a.siteName} · {a.lookbackDays} days</span>
                  <Badge tone="accent">{a.reach.toLocaleString("en-CA")} reach</Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Geo-targeting"
          subtitle="Rules marked Live already run in TAKATAK ADS today."
          action={<Link href="/dashboard/advertising" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">TAKATAK ADS →</Link>}
        />
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {GEO.map((g) => (
            <div key={g.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">{g.name}</p>
                <Badge tone={g.live ? "success" : "muted"}>{g.live ? "Live" : "Planned"}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{g.detail}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Retargeting audiences" subtitle="Built on each network once its pixel or account is connected." />
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {RETARGETING.map((r) => (
            <div key={r.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">{r.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{r.detail}</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Needs: {r.needs}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Pixels & networks</h2>
        <ConnectorGrid connectors={connectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>
          Retargeting requires a consent banner on client websites (Québec Law 25 / PIPEDA). TAKATAK ADS stores no raw IP addresses, emails or
          fingerprints.
        </HonestyNote>
      </section>
    </div>
  );
}
