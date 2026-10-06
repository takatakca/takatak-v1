import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { Badge } from "@/components/ui/badge";
import { activeGrowthPlans, growthEntitlementsEnforced } from "@/lib/billing/growth/entitlements";
import { growthBillingEnabled } from "@/lib/billing/growth/stripe";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { openBillingPortalAction, subscribePlanAction } from "./actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { AI_CREDIT_PACKS } from "@/lib/growth/ai-engine";
import { ALL_IN_BUNDLE, GROWTH_STAGES, SERVICE_PLANS } from "@/lib/growth/plans";

export const dynamic = "force-dynamic";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

function PlanAction({ planKey, active, canBuy }: { planKey: string; active: string[]; canBuy: boolean }) {
  if (active.includes(planKey)) return <Badge tone="success">Active</Badge>;
  if (!canBuy) return null;
  return (
    <form action={subscribePlanAction}>
      <input type="hidden" name="planKey" value={planKey} />
      <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">Subscribe</button>
    </form>
  );
}

const BILLING_NOTICES: Record<string, { ok: boolean; text: string }> = {
  success: { ok: true, text: "Subscription started. It shows as active here as soon as Stripe confirms it." },
  canceled: { ok: false, text: "Checkout was canceled. No charge was made." },
  error: { ok: false, text: "Checkout could not start. Please try again." },
  unavailable: { ok: false, text: "Online subscription is not available for this account yet." },
  no_customer: { ok: false, text: "There is no billing account yet. Subscribe to a plan first." },
};

export default async function GrowthPricingPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const { access } = await requireGrowthAccess("/dashboard/growth/pricing");
  const notice = BILLING_NOTICES[(await searchParams).billing ?? ""] ?? null;
  const canBuy = growthBillingEnabled() && access.mode === "client_scoped" && hasEffectivePermission(access, "manage_settings");
  let active: string[] = [];
  if (access.mode === "client_scoped") {
    try {
      active = await activeGrowthPlans(access.activeClientId);
    } catch {
      console.error("[growth-billing] active plans unavailable");
    }
  }

  const separateTotal = SERVICE_PLANS.reduce((sum, p) => sum + p.monthlyCad, 0);

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Plans & Pricing"
        description="TAKATAK is the one-stop shop: each tool below replaces a separate subscription, and the bundle covers everything."
        badges={[canBuy ? { label: "Online checkout", tone: "success" } : { label: "Draft pricing", tone: "warning" }]}
        actions={
          canBuy && active.length ? (
            <form action={openBillingPortalAction}>
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300">Manage billing</button>
            </form>
          ) : undefined
        }
      />

      {notice ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${notice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">All-in bundle</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <p className="text-xl font-bold text-indigo-950">{ALL_IN_BUNDLE.name}</p>
          <p className="text-lg font-semibold text-indigo-900">{cad.format(ALL_IN_BUNDLE.monthlyCad)}/mo</p>
          <p className="text-xs text-indigo-700 line-through">{cad.format(separateTotal)}/mo separately</p>
        </div>
        <p className="mt-1 text-sm text-indigo-800">{ALL_IN_BUNDLE.summary}</p>
        <p className="mt-1 text-xs text-indigo-700">Includes {ALL_IN_BUNDLE.includedCredits.toLocaleString("en-CA")} AI credits every month.</p>
        <div className="mt-3">
          <PlanAction planKey={ALL_IN_BUNDLE.key} active={active} canBuy={canBuy} />
        </div>
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
                    <div className="mt-3">
                      <PlanAction planKey={plan.key} active={active} canBuy={canBuy} />
                    </div>
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
        {canBuy
          ? "Subscriptions are billed monthly in CAD by Stripe and can be canceled anytime from Manage billing."
          : "Prices are draft values in src/lib/growth/plans.ts and src/lib/growth/ai-engine.ts for the owner to confirm. Nothing on this page charges a card until GROWTH_BILLING_ENABLED is turned on."}
        {growthEntitlementsEnforced() ? " Features unlock with their plan." : " During the pilot every feature stays unlocked."}
      </HonestyNote>
    </div>
  );
}
