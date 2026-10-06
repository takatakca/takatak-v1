import Link from "next/link";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { SiteAuditForm } from "@/components/growth/site-audit-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getConnectorStatuses } from "@/lib/growth/status";

export const dynamic = "force-dynamic";

export default async function SeoOverviewPage() {
  const { showSetupDetails } = await requireGrowthAccess("/dashboard/seo");
  const seoConnectors = getConnectorStatuses().filter((c) => c.category === "seo" || c.key === "search_console" || c.key === "brightlocal");

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="SEO"
        description="Run a live on-page audit of any client website, then layer in keyword, backlink and local-rank data as each SEO provider is connected."
        badges={[{ label: "Site audit live", tone: "success" }]}
      />

      <Card>
        <CardHeader
          title="Site audit"
          subtitle="Checks the live page, robots.txt and sitemap right now. Nothing is stored; no third-party API is called."
        />
        <CardBody>
          <SiteAuditForm />
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/dashboard/seo/keywords" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300">
          <p className="text-sm font-semibold text-slate-900">Keywords →</p>
          <p className="mt-1 text-xs text-slate-600">Rank tracking, search volume and opportunities.</p>
        </Link>
        <Link href="/dashboard/seo/backlinks" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300">
          <p className="text-sm font-semibold text-slate-900">Backlinks →</p>
          <p className="mt-1 text-xs text-slate-600">Referring domains, new and lost links, toxic link watch.</p>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">SEO data providers</h2>
        <ConnectorGrid connectors={seoConnectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>
          Keyword volumes, rankings and backlink counts are never estimated. They appear only after a provider above has real credentials and a
          verified API call.
        </HonestyNote>
      </section>
    </div>
  );
}
