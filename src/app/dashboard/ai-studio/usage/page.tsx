import Link from "next/link";

import { AiHeader } from "@/components/ai-studio/ai-header";
import { AiSourceBanner } from "@/components/ai-studio/ai-source-banner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { actionLabel, estimateCadCents, formatCad, getAiUsageData, reasonLabel, starterPackRateLabel } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Utilisation et coût",
  robots: { index: false, follow: false },
};

export default async function AiUsagePage() {
  const data = await getAiUsageData();
  const rate = starterPackRateLabel();

  return (
    <div className="space-y-5">
      <AiHeader
        title="Utilisation et coût"
        subtitle={`Solde de crédits de cet espace et coût estimé au tarif publié du forfait Starter (${rate}). Ceci n'est pas une facture.`}
        badges={[{ label: "Crédits" }]}
        actions={
          <Link href="/dashboard/ai-studio/saved" className="text-sm font-medium text-indigo-700 hover:text-indigo-500">
            Brouillons
          </Link>
        }
      />
      <p className="text-xs text-slate-500">
        Credit balance for this workspace and an estimate at the published Starter pack rate. This is not an invoice.
      </p>
      <AiSourceBanner source={data.source === "database" ? "database" : "unavailable"} label={data.label} />

      {data.source === "database" ? (
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Soldes">
          <Card>
            <CardBody>
              <p className="text-xs font-medium text-slate-500">Solde</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.balance} crédits</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs font-medium text-slate-500">Utilisés ce mois</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.spentThisMonth} crédits</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs font-medium text-slate-500">Coût estimé</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCad(data.estimatedCadCents ?? 0)}</p>
            </CardBody>
          </Card>
        </section>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {data.source === "selection_required"
            ? "Sélectionnez un espace client pour voir son solde. Les tarifs ci-dessous sont le catalogue, pas une dépense."
            : "Le solde de cet espace n'est pas disponible. Les tarifs ci-dessous restent le catalogue publié."}
        </p>
      )}

      <Card>
        <CardHeader title="Mouvements récents" subtitle="Les 25 dernières écritures de cet espace." />
        <CardBody className="space-y-2">
          {data.entries.length ? (
            data.entries.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
                <div>
                  <p className="text-xs font-medium text-slate-800">
                    {reasonLabel(entry.reason)} · {actionLabel(entry.actionKey, data.actions)}
                  </p>
                  <p className="text-[11px] text-slate-400">{entry.createdAt}</p>
                </div>
                <p className="text-xs font-medium text-slate-700">
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta} · solde {entry.balanceAfter}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">Aucune écriture de crédit pour cet affichage.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tarifs des actions" subtitle={`Estimation au forfait Starter (${rate}).`} />
        <CardBody className="space-y-2">
          {data.actions.map((action) => (
            <div key={action.key} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-700">
                {action.label} <span className="text-slate-400">· {action.module}</span>
              </span>
              <span className="font-medium text-slate-900">
                {action.credits} crédit{action.credits > 1 ? "s" : ""} · {formatCad(estimateCadCents(action.credits))}
              </span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
