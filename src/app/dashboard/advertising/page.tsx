import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getAdsWorkspaceSnapshot } from "@/lib/ads/management-service";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

function money(cents: number): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

export default async function AdvertisingPage() {
  const access = await requireWorkspacePermission(
    "view_ads",
    "/dashboard/advertising",
  );
  const data = await getAdsWorkspaceSnapshot(access.activeClientId);

  const plan =
    data.subscription?.planName ??
    data.subscription?.planCode ??
    "Aucun abonnement TAKATAK ADS";

  const kpis = [
    ["Campagnes", String(data.totals.campaigns)],
    ["Budget total", money(data.totals.budgetCents)],
    ["Dépensé", money(data.totals.spentCents)],
    ["Impressions", data.totals.impressions.toLocaleString("fr-CA")],
    ["Clics", data.totals.clicks.toLocaleString("fr-CA")],
    ["Leads vérifiés", data.totals.leads.toLocaleString("fr-CA")],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
          GROUPE TAKATAK
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">
          TAKATAK ADS
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Réseau publicitaire local propriétaire : inventaire TAKATAK, ciblage
          contextuel/local, créatifs Local Lab et attribution FLEXS.
        </p>
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Plan actuel
        </p>
        <p className="mt-1 text-lg font-semibold text-indigo-950">{plan}</p>
        <p className="mt-1 text-sm text-indigo-800">
          Les campagnes ne sont diffusées que lorsque l’abonnement, le créatif,
          le budget, le placement et les règles de ciblage sont tous valides.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([label, value]) => (
          <Card key={label}>
            <CardBody>
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
            </CardBody>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader
          title="Campagnes"
          subtitle="Données réelles du workspace actif — aucun chiffre simulé."
        />
        <CardBody className="p-0">
          {data.campaigns.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-500">
              Aucune campagne TAKATAK ADS pour ce workspace.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="grid gap-2 px-5 py-4 sm:grid-cols-[1.6fr_1fr_1fr_1fr]"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {campaign.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {campaign.businessBrand?.name ?? "Workspace"} ·{" "}
                      {campaign.scope}
                    </p>
                  </div>
                  <div className="text-sm text-slate-600">
                    {campaign.status}
                  </div>
                  <div className="text-sm text-slate-600">
                    {money(campaign.spentCents)} / {money(campaign.budgetCents)}
                  </div>
                  <div className="text-sm text-slate-600">
                    {campaign._count.events.toLocaleString("fr-CA")} événements
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Inventaire disponible"
          subtitle="Publishers et placements actuellement enregistrés dans TAKATAK ADS."
        />
        <CardBody className="space-y-4">
          {data.publishers.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucun publisher n’est encore enregistré. Exécuter le seed AHMV
              après la migration ADS.
            </p>
          ) : (
            data.publishers.map((publisher) => (
              <div key={publisher.id}>
                <p className="text-sm font-semibold text-slate-900">
                  {publisher.name} · {publisher.domain}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {publisher.placements.map((placement) => placement.code).join(" · ")}
                </p>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <p className="text-xs leading-5 text-slate-500">
        Les comparaisons de performance comme « 30 % moins cher » ou « 80 %
        plus efficace » restent désactivées comme affirmations commerciales
        tant que les données mesurées TAKATAK ne les démontrent pas.
      </p>
    </div>
  );
}
