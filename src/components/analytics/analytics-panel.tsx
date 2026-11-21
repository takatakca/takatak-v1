import Link from "next/link";

import { deleteAudienceAction, toggleSiteAction } from "@/app/dashboard/growth/analytics/actions";
import { CopySnippet } from "@/components/growth/copy-snippet";
import { GrowthKpi } from "@/components/growth/growth-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/lib/analytics/service";

import { verificationMetaTag, verificationTxtValue } from "@/lib/analytics/verification";

import { CreateAudienceForm, CreateSiteForm, LinkGoogleForm, VerifySiteForm } from "./analytics-forms";
import { DailyChart, TopList } from "./daily-chart";

export function AnalyticsPanel({
  data,
  canManage,
  origin,
  googleEmail = null,
}: {
  data: AnalyticsSummary;
  canManage: boolean;
  origin: string;
  googleEmail?: string | null;
}) {
  const qs = (patch: Record<string, string | number | null>) => {
    const params = new URLSearchParams();
    const site = "site" in patch ? patch.site : data.selectedSiteId;
    const days = "days" in patch ? patch.days : data.days;
    if (site) params.set("site", String(site));
    if (days && days !== 30) params.set("days", String(days));
    const s = params.toString();
    return s ? `?${s}` : "?";
  };
  // Share of visits that converted at least once — never above 100%.
  const convRate = data.totals.visitors ? ((data.totals.convertingVisitors / data.totals.visitors) * 100).toFixed(1) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-slate-500">Site · Website :</span>
        <Link href={qs({ site: null })} className={`rounded-full px-3 py-1 ${!data.selectedSiteId ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
          Tous · All
        </Link>
        {data.sites.map((s) => (
          <Link key={s.id} href={qs({ site: s.id })} className={`rounded-full px-3 py-1 ${data.selectedSiteId === s.id ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
            {s.name}
          </Link>
        ))}
        <span className="ml-auto font-medium text-slate-500">Période · Period :</span>
        {[7, 30, 90].map((d) => (
          <Link key={d} href={qs({ days: d })} className={`rounded-full px-3 py-1 ${data.days === d ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
            {d} jours
          </Link>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <GrowthKpi label="Pages vues · Page views" value={data.totals.pageviews.toLocaleString("fr-CA")} />
        <GrowthKpi label="Visites (uniques par jour) · Visits" value={data.totals.visitors.toLocaleString("fr-CA")} hint="Sans témoins ; remis à zéro chaque jour · Cookie-free" />
        <GrowthKpi label="Conversions" value={data.totals.conversions.toLocaleString("fr-CA")} hint="Appels, formulaires, WhatsApp, autres · Calls, forms" />
        <GrowthKpi label="Taux de conversion · Conversion rate" value={convRate !== null ? `${convRate.replace(".", ",")} %` : "—"} hint="Visites avec au moins 1 conversion · Visits with ≥1 conversion" />
      </section>

      <Card>
        <CardHeader title="Pages vues · Page views" subtitle={`${data.days} derniers jours · Last ${data.days} days`} />
        <CardBody>
          <DailyChart data={data.daily.map((d) => ({ day: d.day, value: d.pageviews }))} label="Pages vues · Page views" />
        </CardBody>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <TopList title="Pages les plus vues · Top pages" rows={data.topPages} empty="Aucune page vue pour l’instant · No page views yet." />
        <TopList title="Sources de trafic · Traffic sources" rows={data.topReferrers} empty="Aucun référent pour l’instant (accès direct seulement) · No referrers yet." />
        <TopList title="Conversions" rows={data.conversions} empty="Aucune conversion pour l’instant · No conversions yet." />
        <TopList title="Campagnes (utm_campaign) · Campaigns" rows={data.campaigns} empty="Ajoutez utm_campaign à vos liens d’annonces pour les voir ici · Tag ad links with utm_campaign." />
        <TopList title="Appareils · Devices" rows={data.devices} empty="—" />
        <TopList title="Pays · Countries" rows={data.countries} empty="Le pays s’affiche quand le site passe par un réseau qui l’indique (ex. : Cloudflare) · Shown when a CDN provides it." />
      </section>

      <Card>
        <CardHeader
          title="Publics de reciblage · Retargeting audiences"
          subtitle="Des règles bâties sur vos propres visiteurs ; la portée compte les visites correspondantes (uniques par jour) sur la période · Built from your own visitors."
        />
        <CardBody className="space-y-3">
          {data.audiences.length === 0 ? <p className="text-sm text-slate-500">Aucun public pour l’instant · No audiences yet.</p> : null}
          {data.audiences.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-xs">
              <p className="text-sm font-semibold text-slate-900">{a.name}</p>
              <span className="text-slate-500">{a.siteName}</span>
              <span className="text-slate-500">
                {[a.pathPrefixes.length ? `pages ${a.pathPrefixes.join(", ")}` : null, a.eventNames.length ? `événements ${a.eventNames.join(", ")}` : null]
                  .filter(Boolean)
                  .join(" ou ")}{" "}
                · {a.lookbackDays} jours
              </span>
              <Badge tone="accent">{a.reach.toLocaleString("fr-CA")} personnes · reach</Badge>
              {canManage ? (
                <form action={deleteAudienceAction} className="ml-auto">
                  <input type="hidden" name="audienceId" value={a.id} />
                  <button className="text-slate-400 hover:text-rose-600">Supprimer · Delete</button>
                </form>
              ) : null}
            </div>
          ))}
          {canManage && data.sites.length > 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4">
              <CreateAudienceForm sites={data.sites.map((s) => ({ id: s.id, name: s.name }))} />
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Sites suivis · Tracked websites"
          subtitle="Sans témoins : aucune bannière de consentement requise pour l’analytique seule ; les données ne sont acceptées que du domaine du site · Cookie-free; data is only accepted from each site's own domain."
        />
        <CardBody className="space-y-4">
          {data.sites.map((s) => (
            <div key={s.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                <span className="text-xs text-slate-500">{s.domain}</span>
                {s.brandName ? <span className="text-xs text-slate-400">· {s.brandName}</span> : null}
                <Badge tone={s.active ? "success" : "muted"}>{s.active ? "En collecte · Collecting" : "En pause · Paused"}</Badge>
                {canManage ? (
                  <form action={toggleSiteAction} className="ml-auto">
                    <input type="hidden" name="siteId" value={s.id} />
                    <input type="hidden" name="active" value={s.active ? "false" : "true"} />
                    <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">{s.active ? "Mettre en pause · Pause" : "Reprendre · Resume"}</button>
                  </form>
                ) : null}
              </div>
              <CopySnippet code={`<script defer src="${origin}/takatak-analytics.js" data-site="${s.publicKey}"></script>`} />
              {canManage ? (
                <details className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                    Connexions Google · Google connections{s.ga4PropertyId || s.searchConsoleProperty ? " ✓" : ""}
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] font-semibold text-slate-700">1. Prouvez que {s.domain} vous appartient · Prove you own it</p>
                        <Badge tone={s.domainVerifiedAt ? "success" : "warning"}>{s.domainVerifiedAt ? "Vérifié · Verified" : "Non vérifié · Not verified"}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Ajoutez cet enregistrement TXT au DNS de {s.domain}, ou la balise meta dans le &lt;head&gt; de sa page d’accueil, puis vérifiez. Les données
                        Google ne s’affichent que pour les sites vérifiés · Add the TXT record or the meta tag, then verify.
                      </p>
                      <CopySnippet code={verificationTxtValue(s.verificationToken)} hint={`Option A — enregistrement DNS TXT sur ${s.domain}`} />
                      <CopySnippet code={verificationMetaTag(s.verificationToken)} hint={`Option B — dans le <head> de https://${s.domain}/`} />
                      <VerifySiteForm siteId={s.id} verified={Boolean(s.domainVerifiedAt)} />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-700">2. Branchez Google · Connect Google</p>
                    {googleEmail ? (
                      <p className="text-[11px] text-slate-500">
                        Dans GA4 (Lecteur) et Search Console (Utilisateur restreint), ajoutez <span className="font-mono text-slate-700">{googleEmail}</span>, puis collez
                        les identifiants ici · Add this address in GA4 (Viewer) and Search Console (Restricted user), then paste the IDs.
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-700">
                        La connexion Google s’ouvre dès que TAKATAK branche son compte Google ; écrivez au soutien pour l’activer · Google data turns on once
                        TAKATAK connects its Google account; message support to turn it on.
                      </p>
                    )}
                    {s.domainVerifiedAt ? (
                      <LinkGoogleForm siteId={s.id} ga4PropertyId={s.ga4PropertyId} searchConsoleProperty={s.searchConsoleProperty} />
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Disponible dès que {s.domain} est vérifié. La propriété GA4 doit avoir un flux Web sur {s.domain}, et la propriété Search Console doit être
                        sc-domain:{s.domain} ou https://{s.domain}/ · Available once the domain is verified.
                      </p>
                    )}
                  </div>
                </details>
              ) : null}
            </div>
          ))}
          {canManage ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">Ajouter un site · Add a website</p>
              <CreateSiteForm brands={data.brands} />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
