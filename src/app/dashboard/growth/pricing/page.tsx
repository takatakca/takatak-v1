import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { AI_CREDIT_PACKS } from "@/lib/growth/ai-engine";
import { ALL_IN_BUNDLE, GROWTH_STAGES, SERVICE_PLANS } from "@/lib/growth/plans";

export const dynamic = "force-dynamic";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export default async function GrowthPricingPage() {
  await requireGrowthAccess("/dashboard/growth/pricing");
  const separateTotal = SERVICE_PLANS.reduce((sum, p) => sum + p.monthlyCad, 0);

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Plans & Pricing"
        description="TAKATAK is the one-stop shop: each tool below replaces a separate subscription, and the bundle covers everything."
        badges={[{ label: "Draft pricing", tone: "warning" }]}
      />

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">All-in bundle</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <p className="text-xl font-bold text-indigo-950">{ALL_IN_BUNDLE.name}</p>
          <p className="text-lg font-semibold text-indigo-900">{cad.format(ALL_IN_BUNDLE.monthlyCad)}/mo</p>
          <p className="text-xs text-indigo-700 line-through">{cad.format(separateTotal)}/mo separately</p>
        </div>
        <p className="mt-1 text-sm text-indigo-800">{ALL_IN_BUNDLE.summary}</p>
      </div>

      {GROWTH_STAGES.map((stage) => {
        const plans = SERVICE_PLANS.filter((p) => p.stage === stage.key);
        if (plans.length === 0) return null;
        return (
          <section key={stage.key} className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {stage.step}. {stage.title}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => (
                <Card key={plan.key}>
                  <CardBody>
                    <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                    <p className="mt-1 text-xl font-bold text-slate-950">
                      {cad.format(plan.monthlyCad)}
                      <span className="text-xs font-medium text-slate-500">/mo</span>
                    </p>
                    {plan.replaces ? <p className="text-[11px] text-slate-400">Replaces {plan.replaces}</p> : null}
                    <ul className="mt-3 space-y-1 text-xs text-slate-600">
                      {plan.includes.map((item) => (
                        <li key={item}>✓ {item}</li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      <Card>
        <CardHeader title="AI credits" subtitle="Pay as you go on top of any plan." />
        <CardBody className="flex flex-wrap gap-3">
          {AI_CREDIT_PACKS.map((p) => (
            <div key={p.key} className="rounded-xl border border-slate-200 px-4 py-2 text-sm">
              <span className="font-semibold text-slate-900">{p.credits.toLocaleString("en-CA")} credits</span>{" "}
              <span className="text-slate-600">· {cad.format(p.priceCad)}</span>
            </div>
          ))}
        </CardBody>
      </Card>

      <HonestyNote>
        Prices are draft values in src/lib/growth/plans.ts and src/lib/growth/ai-engine.ts for the owner to confirm. Nothing on this page
        charges a card. Checkout connects through Stripe in a later step.
      </HonestyNote>
    </div>
  );
}
