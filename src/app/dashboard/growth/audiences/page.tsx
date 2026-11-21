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
  { name: "Visiteurs du site · Website visitors", detail: "Toutes les visites des 30, 60 ou 90 derniers jours · Everyone who visited in the last 30/60/90 days.", needs: "TAKATAK Analytics (en marche) ; synchro avec Meta, Google, TikTok" },
  { name: "Visiteurs très intéressés · High-intent visitors", detail: "Ont vu les prix, la réservation ou le contact sans convertir · Viewed pricing, booking or contact without converting.", needs: "Pixel + événements de conversion" },
  { name: "Abonnés engagés · Social engagers", detail: "Ont aimé, commenté ou écrit à vos pages · Liked, commented or messaged your pages.", needs: "Meta Ads" },
  { name: "Liste de clients · Customer list", detail: "Anciens clients (chiffrés) pour les relancer ou les exclure · Hashed past customers for re-engagement or exclusion.", needs: "Module Prospects + Meta/Google Ads" },
  { name: "Publics similaires · Lookalikes", detail: "De nouvelles personnes qui ressemblent à vos meilleurs clients · New people who resemble your best customers.", needs: "Meta Ads ou Google Ads" },
  { name: "Prospects abandonnés · Abandoned leads", detail: "Ont commencé un formulaire ou un clavardage sans finir · Started a form or chat but never finished.", needs: "Clavardage + pixel" },
];

const GEO = [
  { name: "Pays, région et ville · Country, region and city", detail: "Annonces seulement là où l’entreprise travaille · Serve ads only where the business operates.", live: true },
  { name: "Débuts de code postal · Postal-code prefixes", detail: "Cibler des quartiers précis (ex. : H4G, H4H) · Target specific neighbourhoods.", live: true },
  { name: "Langue et appareil · Language and device", detail: "Créations en français ou en anglais ; mobile ou ordinateur · French or English creatives; mobile or desktop.", live: true },
  { name: "Rayon autour de l’entreprise · Radius around the business", detail: "Annonces à N km de chaque adresse sur Google et Meta · Ads within N km of each location.", live: false },
  { name: "Géorepérage des concurrents · Competitor geofencing", detail: "Joindre les gens près des concurrents · Reach people near competitor locations.", live: false },
  { name: "Grille locale · Local grid insights", detail: "Croiser le classement local (QMAPS) avec les campagnes géociblées · Pair map-pack rank grids with geo campaigns.", live: false },
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
        title="Reciblage et géociblage · Retargeting & Geo-targeting"
        description="Faites revenir les gens qui ont déjà montré de l’intérêt, et ne dépensez que dans les quartiers qui comptent · Bring back interested people and spend only where it matters."
      />

      {audiences ? (
        <Card>
          <CardHeader
            title="Vos publics · Your audiences"
            subtitle="Bâtis à partir des visiteurs de TAKATAK Analytics ; la synchro avec Meta ou Google s’active quand ces comptes sont branchés · Sync turns on when those ad accounts are connected."
            action={<Link href="/dashboard/growth/analytics" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">Gérer · Manage →</Link>}
          />
          <CardBody className="space-y-2">
            {audiences.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun public pour l’instant ; créez-en un dans Analytique dès que votre site recueille des visites · No audiences yet.</p>
            ) : (
              audiences.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-800">{a.name}</span>
                  <span className="text-slate-500">{a.siteName} · {a.lookbackDays} jours · days</span>
                  <Badge tone="accent">{a.reach.toLocaleString("fr-CA")} personnes · reach</Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Géociblage · Geo-targeting"
          subtitle="Les règles « En marche » fonctionnent déjà dans TAKATAK ADS · Rules marked Live already run in TAKATAK ADS today."
          action={<Link href="/dashboard/advertising" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">TAKATAK ADS →</Link>}
        />
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {GEO.map((g) => (
            <div key={g.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">{g.name}</p>
                <Badge tone={g.live ? "success" : "muted"}>{g.live ? "En marche · Live" : "Prévu · Planned"}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{g.detail}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Publics de reciblage · Retargeting audiences"
          subtitle="Créés sur chaque réseau dès que son pixel ou son compte est branché · Built on each network once its pixel or account is connected."
        />
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {RETARGETING.map((r) => (
            <div key={r.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">{r.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{r.detail}</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Requis · Needs : {r.needs}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Pixels et réseaux · Pixels &amp; networks</h2>
        <ConnectorGrid connectors={connectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>
          Le reciblage exige une bannière de consentement sur le site (Loi 25 du Québec, LPRPDE). TAKATAK ADS ne garde aucune adresse IP brute,
          aucun courriel ni empreinte · Retargeting requires a consent banner (Québec Law 25 / PIPEDA); TAKATAK ADS stores no raw IPs, emails or
          fingerprints.
        </HonestyNote>
      </section>
    </div>
  );
}
