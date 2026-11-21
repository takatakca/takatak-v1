import { AdsSummaryCard } from "@/components/growth/ads-summary-card";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getActiveWorkspaceAdsSummary } from "@/lib/growth/ads-summary";
import { getConnectorStatuses } from "@/lib/growth/status";

export const dynamic = "force-dynamic";

const CAPABILITIES = [
  { name: "Tous les réseaux, un tableau · All networks, one table", detail: "Dépenses, clics, prospects et coût par prospect pour Google, Meta, TikTok, Microsoft et TAKATAK ADS · Spend, clicks, leads and cost per lead." },
  { name: "Garde-fous budgétaires · Budget guardrails", detail: "Plafonds quotidiens et alertes ; l’IA propose, une personne approuve chaque changement de dépense · A human approves any spend change." },
  { name: "Attribution des prospects · Lead attribution", detail: "Chaque prospect relié à sa campagne, son annonce et son mot-clé (FLEXS) · Every lead traced to its campaign, ad and keyword." },
  { name: "Textes d’annonces par l’IA · AI ad copy", detail: "Titres et descriptions dans la voix de la marque, payés en crédits · Headlines and descriptions in the brand voice, paid with credits." },
  { name: "Annonces Google Business · Google Business ads", detail: "Promotion locale et carte Google, reliée aux Fiches locales · Local and map-pack promotion tied to Local Listings." },
  { name: "Synchro des formulaires · Lead-form sync", detail: "Les formulaires Facebook et Google arrivent dans le pipeline · Facebook and Google lead forms land in the Leads pipeline." },
];

export default async function AdsManagerPage() {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/growth/ads-manager");
  const ads = await getActiveWorkspaceAdsSummary(access);
  const connectors = getConnectorStatuses().filter((c) => c.category === "ads");

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Gestion des publicités · Ads Manager"
        description="Gérez et comparez chaque réseau publicitaire sur un seul écran, à commencer par TAKATAK ADS, déjà en marche · Run and compare every ad network from one screen."
      />
      <AdsSummaryCard summary={ads} />
      <Card>
        <CardHeader title="Ce que fait la gestion des publicités · What Ads Manager does" />
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {CAPABILITIES.map((c) => (
            <div key={c.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">{c.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{c.detail}</p>
            </div>
          ))}
        </CardBody>
      </Card>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Réseaux publicitaires · Ad networks</h2>
        <ConnectorGrid connectors={connectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>
          Les réseaux externes ne dépensent jamais d’argent depuis ce tableau de bord sans une action approuvée par une personne · External networks never
          spend money from this dashboard without an explicit, human-approved action.
        </HonestyNote>
      </section>
    </div>
  );
}
