import {
  Activity,
  BadgeDollarSign,
  Bot,
  Cable,
  ChartNoAxesCombined,
  CircleDollarSign,
  Headphones,
  MessageSquareText,
  ShieldCheck,
  Users,
} from "lucide-react";

import { AdminHeader } from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getAhmvAdminProductData } from "@/lib/admin/ahmv-product-data";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

function money(minor: number, currency = "CAD") {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

const SECTIONS = [
  ["Customers", Users, "Comptes ayant une projection d’abonnement AHMV."],
  ["Subscriptions", ShieldCheck, "Statuts, plans et accès ahmv_access."],
  ["Usage", Activity, "Base pour les événements d’usage produit."],
  ["Revenue", CircleDollarSign, "MRR estimé et contributions distinctes."],
  ["Automations", Bot, "Auto-Pilot et orchestrations TAKATAK."],
  ["Connectors", Cable, "Services partagés, jamais des secrets dans AHMV."],
  ["Support", Headphones, "Support produit et opérations."],
  ["Analytics", ChartNoAxesCombined, "Performance produit et adoption."],
] as const;

export default async function AhmvAdminProductPage() {
  await requireAdminAccess();
  const data = await getAhmvAdminProductData();

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Product • AHMV"
        subtitle="Back-office TAKATAK pour le produit AHMV. Cette surface admin est distincte de l’expérience parent."
        badges={["Admin only", "Product catalog", "Entitlement controlled"]}
      />

      {!data.available || !data.product ? (
        <Card>
          <CardHeader
            title="Catalogue AHMV indisponible"
            subtitle="La base produit doit être migrée avant d’activer cette surface."
          />
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Clients projetés" value={String(data.counts.customers)} />
            <Metric label="Accès actifs" value={String(data.counts.active)} />
            <Metric label="Past due" value={String(data.counts.pastDue)} />
            <Metric label="Annulés" value={String(data.counts.canceled)} />
            <Metric label="MRR estimé" value={money(data.estimatedMrrMinor)} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <Card>
              <CardHeader
                title="Plans configurables"
                subtitle="Prix et cadence proviennent du Product Catalog; aucun montant n’est codé dans l’interface AHMV."
              />
              <CardBody className="space-y-3">
                {data.product.plans.map((plan) => (
                  <div
                    key={plan.code}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{plan.name}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {plan.code}
                          {plan.legacyCode ? ` • legacy: ${plan.legacyCode}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge tone={plan.status === "active" ? "success" : "neutral"}>
                          {plan.status}
                        </Badge>
                        <Badge tone={plan.selfServeEligible ? "success" : "neutral"}>
                          {plan.selfServeEligible ? "self-serve" : "admin/roadmap"}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Prix courant
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-950">
                          {plan.price
                            ? money(plan.price.unitAmountMinor, plan.price.currency)
                            : "Non configuré"}
                        </p>
                        {plan.price ? (
                          <p className="text-xs text-slate-500">
                            / {plan.price.intervalCount > 1 ? `${plan.price.intervalCount} ` : ""}
                            {plan.price.billingInterval}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Entitlements
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {plan.entitlements.map((entitlement) => (
                            <Badge key={entitlement.code} tone="neutral">
                              {entitlement.code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Revenue Center"
                subtitle="Abonnements et soutien au développement restent deux flux distincts."
              />
              <CardBody className="space-y-4">
                <RevenueRow
                  label="MRR estimé memberships"
                  value={money(data.estimatedMrrMinor)}
                  icon={BadgeDollarSign}
                />
                <RevenueRow
                  label="Contributions payées"
                  value={money(data.contributions.grossMinor)}
                  icon={CircleDollarSign}
                />
                <RevenueRow
                  label="Frais contributions"
                  value={money(data.contributions.feesMinor)}
                  icon={MessageSquareText}
                />
                <RevenueRow
                  label="Net contributions"
                  value={money(data.contributions.netMinor)}
                  icon={ChartNoAxesCombined}
                />
                <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  Le MRR est une projection basée sur les abonnements donnant accès et le prix courant du catalogue.
                  Les revenus encaissés, remboursements et frais Stripe des memberships nécessitent le registre de transactions
                  avant d’être présentés comme comptabilité réelle.
                </p>
              </CardBody>
            </Card>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SECTIONS.map(([title, Icon, description]) => (
              <Card key={title}>
                <CardBody>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Icon className="size-5" />
                  </div>
                  <p className="mt-4 font-semibold text-slate-950">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                </CardBody>
              </Card>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      </CardBody>
    </Card>
  );
}

function RevenueRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof CircleDollarSign;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}
