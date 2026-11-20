import { Camera, LineChart, MapPin, MessageSquare, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CitationCard } from "@/components/local-listings/citation-card";
import { LocalListingCard } from "@/components/local-listings/local-listing-card";
import { LocalListingsHeader } from "@/components/local-listings/local-listings-header";
import { LocalListingsKpiCard } from "@/components/local-listings/local-listings-kpi-card";
import { LocalSourceBanner } from "@/components/local-listings/source-banner";
import { ReviewCard } from "@/components/local-listings/review-card";
import { VisibilitySnapshotCard } from "@/components/local-listings/visibility-snapshot-card";
import { getListingCitationsData, getLocalListingsOverviewData } from "@/lib/local-listings/local-listings-data";
import { QuickLinks } from "@/components/dashboard/quick-links";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  { label: "Listings", href: "/dashboard/local-listings/listings" },
  { label: "Citations", href: "/dashboard/local-listings/citations" },
  { label: "Reviews", href: "/dashboard/local-listings/reviews" },
  { label: "Visibility", href: "/dashboard/local-listings/visibility" },
  { label: "Ask the team", href: "/dashboard/support" },
];

export default async function LocalListingsOverviewPage() {
  const data = await getLocalListingsOverviewData();
  const citations = await getListingCitationsData();
  const kpis = [
    { label: "Listings", value: data.kpis.listings, icon: MapPin },
    { label: "Citations", value: data.kpis.citations, icon: Newspaper },
    { label: "Reviews", value: data.kpis.reviews, icon: MessageSquare },
    { label: "Photos", value: data.kpis.photos, icon: Camera },
    { label: "Visibility Snapshots", value: data.kpis.snapshots, icon: LineChart },
  ];
  const health = [
    { label: "Total citations", value: data.citationHealth.total },
    { label: "Found (internal only)", value: data.citationHealth.foundInternal },
    { label: "Needs update", value: data.citationHealth.needsUpdate },
    { label: "Missing", value: data.citationHealth.missing },
  ];
  return (
    <div className="space-y-6">
      <LocalListingsHeader
        title="Local Listings"
        subtitle="Your business listings, directory citations, reviews and local visibility in one place."
      />

      <section aria-label="Local listings KPIs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => <LocalListingsKpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} />)}
        </div>
        <div className="mt-2"><LocalSourceBanner source={data.source} label={data.sourceLabel} /></div>
      </section>

      <section className="space-y-3" aria-label="Listings">
        <h2 className="text-sm font-semibold text-slate-900">Listing Status</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.listings.map((l) => <LocalListingCard key={l.id} listing={l} />)}
        </div>
      </section>

      <Card>
        <CardHeader title="Citation Health" subtitle="Whether your name, address and phone match across directories." />
        <CardBody className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {health.map((h) => (
            <div key={h.label} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
              <p className="text-lg font-semibold text-slate-900">{h.value}</p>
              <p className="text-[10px] text-slate-400">{h.label}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <section className="space-y-3" aria-label="Reviews">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Review Monitoring</h2>
          <Badge tone="muted">Internal demo reviews</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Visibility">
        <h2 className="text-sm font-semibold text-slate-900">Local Visibility Snapshot</h2>
        <p className="text-[11px] text-slate-400">Foundation visibility only — not from QMAPS or Google data.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.snapshots.map((s) => <VisibilitySnapshotCard key={s.id} snapshot={s} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Citations preview">
        <h2 className="text-sm font-semibold text-slate-900">Citations</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {citations.citations.slice(0, 4).map((c) => <CitationCard key={c.id} citation={c} />)}
        </div>
      </section>

      <QuickLinks links={QUICK_ACTIONS} />
    </div>
  );
}
