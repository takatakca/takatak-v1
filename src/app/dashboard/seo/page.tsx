import Link from "next/link";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { PageSpeedForm } from "@/components/growth/pagespeed-form";
import { SeoScoreHistory } from "@/components/growth/seo-score-history";
import { SiteAuditForm } from "@/components/growth/site-audit-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getPrisma } from "@/lib/db/prisma";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getConnectorStatuses } from "@/lib/growth/status";
import { pageSpeedConfigured } from "@/lib/seo/pagespeed";
import { listSeoScores } from "@/lib/seo/score-store";

export const dynamic = "force-dynamic";

export default async function SeoOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ reaudit?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawCount = Array.isArray(params.reaudit) ? params.reaudit[0] : params.reaudit;
  const reauditCount = rawCount !== undefined && /^[0-3]$/.test(rawCount) ? Number(rawCount) : null;
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/seo");
  const seoConnectors = getConnectorStatuses().filter((c) => c.category === "seo" || c.key === "search_console" || c.key === "brightlocal");
  let history: Awaited<ReturnType<typeof listSeoScores>> = [];
  if (access.mode === "client_scoped") {
    const prisma = getPrisma();
    if (prisma) {
      try {
        history = await listSeoScores(prisma, access.activeClientId);
      } catch {
        history = [];
      }
    }
  }

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
          subtitle="Contrôle la page, robots.txt et le sitemap. Le résumé du score est conservé pour cet espace. Le HTML n'est pas enregistré."
        />
        <CardBody>
          <SiteAuditForm />
        </CardBody>
      </Card>

      {access.mode === "client_scoped" ? (
        <SeoScoreHistory rows={history} reauditCount={reauditCount} />
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Sélectionnez un espace client pour conserver l&apos;historique des scores et télécharger le PDF.
        </p>
      )}

      <Card>
        <CardHeader title="Speed & Core Web Vitals" subtitle="Google PageSpeed Insights: the same speed scores Google uses for ranking." />
        <CardBody>
          <PageSpeedForm configured={pageSpeedConfigured()} />
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
