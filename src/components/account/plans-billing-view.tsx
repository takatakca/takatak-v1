"use client";

import { BarChart3, FileText, Loader2, Star, X } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import type { PlansBillingPageData } from "@/lib/billing/social/billing-page-data";
import {
  ADVANCED_PLAN_CODES,
  SOCIAL_PLAN_CATALOG,
  STARTER_PLAN_CODES,
  advancedPlanHighlights,
  annualSavingsPercent,
  customPlanHighlights,
  planFamily,
  starterPlanHighlights,
  type SocialPlanCode,
} from "@/lib/billing/social";

const COUNTRIES = [
  "Canada",
  "United States",
  "United Kingdom",
  "France",
  "Germany",
  "Australia",
];

const money = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

function formatCad(value: number): string {
  return money.format(value);
}

function postsLabel(allowance: number | null): string {
  if (allowance === null) {
    return "Unlimited publications / month";
  }
  return `${allowance} publications / month`;
}

export function PlansBillingView({
  data,
  canManage,
}: {
  data: PlansBillingPageData;
  canManage: boolean;
}) {
  if (data.source === "unavailable") {
    return (
      <section className="mt-8 rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900">
          Plans and billing
        </h2>
        <p className="mt-2 text-sm text-slate-500">{data.message}</p>
      </section>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <CheckoutReturnNotice />
      <CurrentPlanCard data={data} canManage={canManage} />
      <BrandFreezePanel data={data} canManage={canManage} />
      <AddOnsRow data={data} canManage={canManage} />
      <PlanCatalog data={data} canManage={canManage} />
      <PaymentsHistory />
      <BillingInformationForm data={data} canManage={canManage} />
    </div>
  );
}

function CheckoutReturnNotice() {
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");

  if (checkout === "success") {
    return (
      <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        Stripe is confirming this payment. This page does not unlock the plan.
        Refresh in a few seconds after the webhook arrives.
      </p>
    );
  }

  if (checkout === "canceled") {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Checkout was canceled. This workspace is still on its current plan.
      </p>
    );
  }

  return null;
}

async function postBillingJson(
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok?: boolean; url?: string; message?: string; updated?: boolean }> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : "{}",
  });

  const result = (await response.json()) as {
    ok?: boolean;
    url?: string;
    message?: string;
    updated?: boolean;
  };

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? "The billing request failed.");
  }

  return result;
}

function CancelSubscriptionButton({
  checkoutLive,
  stripeCustomerReady,
  canManage,
}: {
  checkoutLive: boolean;
  stripeCustomerReady: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const enabled = checkoutLive && stripeCustomerReady && canManage;

  async function openPortal() {
    if (!enabled || loading) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await postBillingJson("/api/billing/stripe/portal");
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setMessage(result.message ?? "The customer portal did not return a URL.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The customer portal could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <button
        type="button"
        disabled={!enabled || loading}
        onClick={() => void openPortal()}
        title={
          !canManage
            ? "You need permission to change billing."
            : !checkoutLive
              ? "Stripe checkout is not connected yet."
              : !stripeCustomerReady
                ? "Upgrade a plan first so Stripe has a customer for this workspace."
                : "Open Stripe to update the card, invoices, or cancel."
        }
        className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel subscription"}
      </button>
      {message ? (
        <p className="max-w-xs text-right text-xs text-rose-700">{message}</p>
      ) : null}
    </div>
  );
}

function CurrentPlanCard({
  data,
  canManage,
}: {
  data: Extract<PlansBillingPageData, { source: "database" }>;
  canManage: boolean;
}) {
  const periodEnd = data.currentPeriodEnd
    ? new Date(data.currentPeriodEnd).toLocaleDateString("en-CA")
    : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Current plan</p>
          <h2 className="mt-1 text-3xl font-semibold text-[#1d1d1f]">
            {data.planName}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {data.subscriptionStatusLabel}
            {data.cancelAtPeriodEnd && periodEnd
              ? ` · paid until ${periodEnd}`
              : ""}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <a
            href="#plan-catalog"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#2a1728] px-4 text-sm font-semibold text-white"
          >
            View plans
          </a>
          {data.subscriptionAccess === "paid" ? (
            <CancelSubscriptionButton
              checkoutLive={data.checkoutLive}
              stripeCustomerReady={data.stripeCustomerReady}
              canManage={canManage}
            />
          ) : null}
        </div>
      </div>
      {data.subscriptionAccess === "blocked" ? (
        <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
          Social access is locked for this workspace until billing is restored.
        </p>
      ) : null}
      {(data.subscriptionStatus === "past_due" ||
        data.subscriptionStatus === "grace_period") &&
      data.subscriptionAccess === "paid" ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Payment failed. Access stays on until retries finish. Update the
          payment method to keep this plan.
        </p>
      ) : null}
      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-500">
        <div>
          Max brands: {data.entitlements.brandAllowance}
          {data.brandCount ? ` (${data.brandCount} in use)` : ""}
          {data.brandFreeze.frozenCount
            ? ` · ${data.brandFreeze.frozenCount} frozen`
            : ""}
        </div>
        <div>
          X accounts: {data.xAccountCount} of{" "}
          {data.entitlements.xConnectionAllowance}
        </div>
        <div>{postsLabel(data.entitlements.monthlyPostAllowance)}</div>
      </dl>
      {!data.checkoutLive ? (
        <p className="mt-4 text-xs text-slate-400">
          Checkout is not live yet. Add Stripe keys and Price IDs to enable
          Upgrade. Viewing plans does not charge this workspace.
        </p>
      ) : null}
    </section>
  );
}

function BrandFreezePanel({
  data,
  canManage,
}: {
  data: Extract<PlansBillingPageData, { source: "database" }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const freeze = data.brandFreeze;
  const selectable = freeze.brands.filter(
    (brand) => brand.status !== "archived",
  );
  const [selected, setSelected] = useState<string[]>(freeze.defaultKeepIds);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!freeze.overAllowance && !freeze.canAutoRestore && freeze.frozenCount === 0) {
    return null;
  }

  async function submit(brandIds: string[] | undefined) {
    if (!canManage || loading) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/billing/brands/keep", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          brandIds ? { brandIds } : {},
        ),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Brands could not be updated.");
        return;
      }

      setMessage(payload.message ?? "Saved.");
      router.refresh();
    } catch {
      setMessage("Brands could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-[#1d1d1f]">Active brands</h2>
      {freeze.overAllowance ? (
        <p className="mt-2 text-sm text-slate-500">
          This plan allows {freeze.allowance} active brand
          {freeze.allowance === 1 ? "" : "s"}. You have {freeze.billableCount}.
          Choose which stay active. The others are frozen, not deleted.
        </p>
      ) : freeze.canAutoRestore ? (
        <p className="mt-2 text-sm text-slate-500">
          This plan has spare brand slots. Restore frozen brands up to the
          allowance. Scheduled posts stay paused until you review them.
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          {freeze.frozenCount} frozen brand
          {freeze.frozenCount === 1 ? "" : "s"} stay hidden until you upgrade
          or restore them.
        </p>
      )}

      {freeze.overAllowance ? (
        <ul className="mt-4 space-y-2">
          {selectable.map((brand) => {
            const checked = selected.includes(brand.id);
            const atCap =
              !checked && selected.length >= freeze.allowance;
            return (
              <li key={brand.id}>
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canManage || atCap}
                    onChange={() => {
                      setSelected((current) =>
                        current.includes(brand.id)
                          ? current.filter((id) => id !== brand.id)
                          : [...current, brand.id],
                      );
                    }}
                  />
                  <span>
                    {brand.name}
                    {brand.status === "frozen" ? " (frozen)" : ""}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm text-slate-600">{message}</p>
      ) : null}

      {canManage && (freeze.overAllowance || freeze.canAutoRestore) ? (
        <button
          type="button"
          disabled={loading || (freeze.overAllowance && selected.length === 0 && freeze.allowance > 0)}
          onClick={() =>
            void submit(freeze.overAllowance ? selected : undefined)
          }
          className="mt-4 inline-flex h-10 items-center rounded-md bg-[#2a1728] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : freeze.overAllowance ? (
            "Keep selected brands"
          ) : (
            "Restore frozen brands"
          )}
        </button>
      ) : null}
    </section>
  );
}

function AddOnsRow({
  data,
  canManage,
}: {
  data: Extract<PlansBillingPageData, { source: "database" }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"x_account" | "advanced_analytics" | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const analyticsEligible =
    data.entitlements.eligibleAddons.includes("advanced_analytics");
  const xEligible = data.entitlements.eligibleAddons.includes("x_account");
  const live =
    data.addonCheckoutLive &&
    data.stripeSubscriptionReady &&
    data.subscriptionAccess === "paid";

  async function changeAddon(
    addonCode: "x_account" | "advanced_analytics",
    action: "add" | "remove",
  ) {
    if (!canManage || !live || busy) {
      return;
    }

    setBusy(addonCode);
    setMessage(null);

    try {
      const result = await postBillingJson("/api/billing/stripe/addons", {
        addonCode,
        action,
      });
      setMessage(
        result.message ??
          "Stripe is updating this add-on. It appears when the webhook confirms it.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The add-on could not be updated.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-[#1d1d1f]">Add-ons</h2>
      <p className="mt-1 text-sm text-slate-500">
        Add-ons bill with the Social plan. Adding charges now. Removing waits
        until the period ends. This page does not unlock them — the Stripe
        webhook does.
      </p>
      {message ? (
        <p className="mt-3 text-sm text-slate-600">{message}</p>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {data.entitlements.advancedAnalytics
                  ? "Contracted"
                  : "Not contracted"}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-[#1d1d1f]">
                Advanced Analytics Add-on
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Longer analytics history and campaign dashboards.{" "}
                {data.entitlements.advancedAnalytics
                  ? "This workspace already has the add-on."
                  : analyticsEligible
                    ? "Available as an add-on on this plan."
                    : "Not available on the Free plan."}
              </p>
            </div>
          </div>
          {data.entitlements.advancedAnalytics ? (
            <button
              type="button"
              disabled={!canManage || !live || busy !== null}
              onClick={() => void changeAddon("advanced_analytics", "remove")}
              title={
                !canManage
                  ? "You need permission to change billing."
                  : live
                    ? "Remove Advanced Analytics at period end."
                    : "Buy a Starter or Advanced plan through Stripe first."
              }
              className="mt-4 inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              {busy === "advanced_analytics" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remove at period end"
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canManage || !live || !analyticsEligible || busy !== null}
              onClick={() => void changeAddon("advanced_analytics", "add")}
              title={
                !canManage
                  ? "You need permission to change billing."
                  : !analyticsEligible
                    ? "Not available on the Free plan."
                    : live
                      ? "Add Advanced Analytics"
                      : "Buy a Starter or Advanced plan through Stripe first."
              }
              className="mt-4 inline-flex h-10 items-center rounded-md bg-[#2a1728] px-4 text-sm font-semibold text-[#dfff32] disabled:opacity-50"
            >
              {busy === "advanced_analytics" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : live && analyticsEligible ? (
                "Add add-on"
              ) : (
                "Add add-on"
              )}
            </button>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-black text-white">
              <FaXTwitter className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {data.entitlements.xConnectionAllowance > 0
                  ? "Contracted"
                  : "Not contracted"}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-[#1d1d1f]">
                X add-on
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                One paid slot per connected X account.{" "}
                {data.entitlements.xConnectionAllowance > 0
                  ? `This workspace has ${data.entitlements.xConnectionAllowance} paid slot${data.entitlements.xConnectionAllowance === 1 ? "" : "s"} and ${data.xAccountCount} connected.`
                  : xEligible
                    ? "Available as an add-on on this plan."
                    : "Not available on the Free plan."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canManage || !live || !xEligible || busy !== null}
              onClick={() => void changeAddon("x_account", "add")}
              title={
                !canManage
                  ? "You need permission to change billing."
                  : !xEligible
                    ? "Not available on the Free plan."
                    : live
                      ? "Add one X slot"
                      : "Buy a Starter or Advanced plan through Stripe first."
              }
              className="inline-flex h-10 items-center rounded-md bg-[#2a1728] px-4 text-sm font-semibold text-[#dfff32] disabled:opacity-50"
            >
              {busy === "x_account" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add 1 slot"
              )}
            </button>
            {data.entitlements.xConnectionAllowance > 0 ? (
              <button
                type="button"
                disabled={!canManage || !live || busy !== null}
                onClick={() => void changeAddon("x_account", "remove")}
                title="Remove one X slot at period end. Connected accounts are not deleted."
                className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                Remove 1 slot at period end
              </button>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

function PlanCatalog({
  data,
  canManage,
}: {
  data: Extract<PlansBillingPageData, { source: "database" }>;
  canManage: boolean;
}) {
  const [cycle, setCycle] = useState<"monthly" | "annual">("annual");
  const savings = annualSavingsPercent();
  const currentFamily = planFamily(data.planCode);

  const [starterCode, setStarterCode] = useState<SocialPlanCode>(
    currentFamily === "starter" ? data.planCode : "social_starter_5",
  );
  const [advancedCode, setAdvancedCode] = useState<SocialPlanCode>(
    currentFamily === "advanced" ? data.planCode : "social_advanced_15",
  );
  const [checkoutPlan, setCheckoutPlan] = useState<SocialPlanCode | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const router = useRouter();

  async function startCheckout(planCode: SocialPlanCode) {
    if (!data.checkoutLive || !canManage || checkoutPlan) {
      return;
    }

    setCheckoutPlan(planCode);
    setCheckoutMessage(null);

    try {
      const result = await postBillingJson("/api/billing/stripe/checkout", {
        planCode,
        billingCycle: cycle,
      });

      if (result.url) {
        window.location.assign(result.url);
        return;
      }

      setCheckoutMessage(
        result.message ??
          "Stripe is updating this plan. It appears when the webhook confirms it.",
      );
      router.refresh();
    } catch (error) {
      setCheckoutMessage(
        error instanceof Error
          ? error.message
          : "Stripe checkout could not be started.",
      );
    } finally {
      setCheckoutPlan(null);
    }
  }

  const starterFrom = useMemo(() => {
    const prices = STARTER_PLAN_CODES.map((code) =>
      cycle === "annual"
        ? SOCIAL_PLAN_CATALOG[code].displayAnnualMonthlyCad
        : SOCIAL_PLAN_CATALOG[code].displayMonthlyCad,
    );
    return Math.min(...prices);
  }, [cycle]);

  const advancedFrom = useMemo(() => {
    const prices = ADVANCED_PLAN_CODES.map((code) =>
      cycle === "annual"
        ? SOCIAL_PLAN_CATALOG[code].displayAnnualMonthlyCad
        : SOCIAL_PLAN_CATALOG[code].displayMonthlyCad,
    );
    return Math.min(...prices);
  }, [cycle]);

  return (
    <section id="plan-catalog">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#1d1d1f]">Plans</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            <span className="rounded-md bg-[#2a1728] px-3 py-1.5 font-medium text-white">
              CAD
            </span>
            <span
              className="px-3 py-1.5 text-slate-400"
              title="Plans are billed in CAD."
            >
              USD
            </span>
            <span
              className="px-3 py-1.5 text-slate-400"
              title="Plans are billed in CAD."
            >
              EUR
            </span>
          </div>
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`rounded-md px-3 py-1.5 ${
                cycle === "monthly"
                  ? "bg-[#2a1728] font-medium text-white"
                  : "text-slate-600"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 ${
                cycle === "annual"
                  ? "bg-[#2a1728] font-medium text-white"
                  : "text-slate-600"
              }`}
            >
              {savings > 0 ? <Star className="h-3.5 w-3.5 text-amber-400" /> : null}
              Annual{savings > 0 ? ` (Save ${savings}%)` : ""}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <PlanCard
          title="Starter"
          fromLabel={`From ${formatCad(starterFrom)}/month${cycle === "annual" ? "* with annual payment" : ""}`}
          features={starterPlanHighlights()}
          options={STARTER_PLAN_CODES.map((code) => ({
            code,
            label: `up to ${SOCIAL_PLAN_CATALOG[code].brandAllowance} brands`,
            monthly:
              cycle === "annual"
                ? SOCIAL_PLAN_CATALOG[code].displayAnnualMonthlyCad
                : SOCIAL_PLAN_CATALOG[code].displayMonthlyCad,
          }))}
          selected={starterCode}
          onSelect={setStarterCode}
          current={currentFamily === "starter"}
          highlighted={false}
          footerCad={
            cycle === "annual"
              ? SOCIAL_PLAN_CATALOG[starterCode].displayAnnualMonthlyCad * 12
              : SOCIAL_PLAN_CATALOG[starterCode].displayMonthlyCad
          }
          cycle={cycle}
          checkoutLive={data.checkoutLive}
          canManage={canManage}
          loading={checkoutPlan === starterCode}
          onCheckout={() => void startCheckout(starterCode)}
        />

        <PlanCard
          title="Advanced"
          recommended
          fromLabel={`From ${formatCad(advancedFrom)}/month${cycle === "annual" ? "* with annual payment" : ""}`}
          features={advancedPlanHighlights()}
          options={ADVANCED_PLAN_CODES.map((code) => ({
            code,
            label: `up to ${SOCIAL_PLAN_CATALOG[code].brandAllowance} brands`,
            monthly:
              cycle === "annual"
                ? SOCIAL_PLAN_CATALOG[code].displayAnnualMonthlyCad
                : SOCIAL_PLAN_CATALOG[code].displayMonthlyCad,
          }))}
          selected={advancedCode}
          onSelect={setAdvancedCode}
          current={currentFamily === "advanced"}
          highlighted
          footerCad={
            cycle === "annual"
              ? SOCIAL_PLAN_CATALOG[advancedCode].displayAnnualMonthlyCad * 12
              : SOCIAL_PLAN_CATALOG[advancedCode].displayMonthlyCad
          }
          cycle={cycle}
          checkoutLive={data.checkoutLive}
          canManage={canManage}
          loading={checkoutPlan === advancedCode}
          onCheckout={() => void startCheckout(advancedCode)}
        />

        <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-[#1d1d1f]">Custom</h3>
          <p className="mt-2 text-sm text-slate-500">
            Talk to us. Contact us for pricing.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
            {customPlanHighlights().map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" checked readOnly className="accent-[#2a1728]" />
            More than 50 brands: Talk to us
          </label>
          <div className="mt-auto pt-6">
            <a
              href="/dashboard/support"
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-200 text-sm font-semibold text-slate-700"
            >
              Talk to us
            </a>
          </div>
        </article>
      </div>
      {checkoutMessage ? (
        <p className="mt-3 text-sm text-slate-600">{checkoutMessage}</p>
      ) : null}
      <p className="mt-3 text-xs text-slate-400">
        * Taxes not included. Catalog prices are CAD placeholders until they
        match Stripe Price IDs. Custom stays Talk to us. Add-ons are not
        charged in this step. Returning from Checkout does not unlock a plan
        — the Stripe webhook does.
      </p>
    </section>
  );
}

function PlanCard({
  title,
  recommended,
  fromLabel,
  features,
  options,
  selected,
  onSelect,
  current,
  highlighted,
  footerCad,
  cycle,
  checkoutLive,
  canManage,
  loading,
  onCheckout,
}: {
  title: string;
  recommended?: boolean;
  fromLabel: string;
  features: string[];
  options: Array<{ code: SocialPlanCode; label: string; monthly: number }>;
  selected: SocialPlanCode;
  onSelect: (code: SocialPlanCode) => void;
  current: boolean;
  highlighted: boolean;
  footerCad: number;
  cycle: "monthly" | "annual";
  checkoutLive: boolean;
  canManage: boolean;
  loading: boolean;
  onCheckout: () => void;
}) {
  return (
    <article
      className={`flex flex-col rounded-xl border bg-white p-5 ${
        highlighted ? "border-[#7aa7ff] shadow-sm" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">{title}</h3>
        {recommended ? (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
            Recommended
          </span>
        ) : null}
        {current ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            Current
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-slate-500">{fromLabel}</p>
      <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <div className="mt-5 space-y-2">
        {options.map((option) => (
          <label
            key={option.code}
            className="flex items-center justify-between gap-3 text-sm text-slate-700"
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name={`plan-${title}`}
                checked={selected === option.code}
                onChange={() => onSelect(option.code)}
                className="accent-[#2a1728]"
              />
              {option.label}
            </span>
            <span>{formatCad(option.monthly)}</span>
          </label>
        ))}
      </div>
      <div
        className={`mt-auto flex items-center justify-between gap-3 rounded-md px-3 py-3 text-sm ${
          highlighted
            ? "mt-5 bg-[#2a6bff] text-white"
            : "mt-5 bg-slate-50 text-slate-600"
        }`}
      >
        <span>
          {cycle === "annual" ? "Annual price" : "Monthly price"}{" "}
          {formatCad(footerCad)}
        </span>
      </div>
      <button
        type="button"
        disabled={!checkoutLive || !canManage || loading}
        onClick={onCheckout}
        title={
          !canManage
            ? "You need permission to change the plan."
            : checkoutLive
              ? `Upgrade to ${title}`
              : "Stripe checkout is not connected yet."
        }
        className={`mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold disabled:opacity-50 ${
          highlighted
            ? "bg-[#2a1728] text-[#dfff32]"
            : "bg-slate-200 text-slate-600"
        }`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {checkoutLive ? "Upgrade plan" : "Upgrade (not live yet)"}
      </button>
    </article>
  );
}

function PaymentsHistory() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-[#1d1d1f]">Payments history</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="pb-3 pr-4">Date</th>
              <th className="pb-3 pr-4">Description</th>
              <th className="pb-3 pr-4">Billing period</th>
              <th className="pb-3 pr-4">Amount</th>
              <th className="pb-3">Document</th>
            </tr>
          </thead>
        </table>
      </div>
      <p className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-6 text-sm text-slate-500">
        <FileText className="h-4 w-4 text-slate-400" />
        No payments yet. Invoices appear here when Stripe billing is connected.
        The screenshot amounts are not copied into this workspace.
      </p>
    </section>
  );
}

function BillingInformationForm({
  data,
  canManage,
}: {
  data: Extract<PlansBillingPageData, { source: "database" }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(data.companyName);
  const [vatTaxId, setVatTaxId] = useState(data.vatTaxId);
  const [billingAddress, setBillingAddress] = useState(data.billingAddress);
  const [billingCountry, setBillingCountry] = useState(data.billingCountry);
  const [invoiceEmails, setInvoiceEmails] = useState(data.invoiceEmails);
  const [emailDraft, setEmailDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const countries = COUNTRIES.includes(billingCountry)
    ? COUNTRIES
    : [billingCountry, ...COUNTRIES];

  const dirty =
    companyName !== data.companyName ||
    vatTaxId !== data.vatTaxId ||
    billingAddress !== data.billingAddress ||
    billingCountry !== data.billingCountry ||
    invoiceEmails.join("|") !== data.invoiceEmails.join("|");

  function addEmail() {
    const next = emailDraft.trim().toLowerCase();
    if (!next || invoiceEmails.includes(next)) {
      setEmailDraft("");
      return;
    }
    setInvoiceEmails((current) => [...current, next]);
    setEmailDraft("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || loading || !dirty) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setSuccess(false);
    setFieldErrors({});

    try {
      const response = await fetch("/api/billing/info", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName,
          vatTaxId,
          billingAddress,
          billingCountry,
          invoiceEmails,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        fieldErrors?: Record<string, string>;
      };

      if (!response.ok || !result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setMessage(result.message ?? "Billing information could not be saved.");
        return;
      }

      setSuccess(true);
      setMessage(result.message ?? "Billing information was saved.");
      router.refresh();
    } catch {
      setMessage("A network error occurred. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClassName =
    "mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#4b8bf5] focus:ring-2 focus:ring-[#4b8bf5]/20 disabled:bg-slate-50";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6"
      noValidate
    >
      <h2 className="text-lg font-semibold text-[#1d1d1f]">
        Billing information
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Company, VAT / tax ID, and address come from {data.workspaceName}.
        Empty fields stay empty until someone with permission saves them here.
      </p>

      {message ? (
        <p
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            success
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-600">
          Company *
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            disabled={!canManage}
            className={inputClassName}
          />
          {fieldErrors.companyName ? (
            <span className="mt-1 block text-xs text-rose-600">
              {fieldErrors.companyName}
            </span>
          ) : null}
        </label>
        <label className="block text-sm font-medium text-slate-600">
          VAT/Tax Id Number
          <input
            value={vatTaxId}
            onChange={(event) => setVatTaxId(event.target.value)}
            disabled={!canManage}
            autoComplete="off"
            className={inputClassName}
          />
        </label>
        <label className="block text-sm font-medium text-slate-600 sm:col-span-2">
          Full address
          <input
            value={billingAddress}
            onChange={(event) => setBillingAddress(event.target.value)}
            disabled={!canManage}
            className={inputClassName}
          />
          <span className="mt-1.5 block text-xs font-normal text-slate-500">
            Enter your street, zip code and city
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-600">
          Country *
          <select
            value={billingCountry}
            onChange={(event) => setBillingCountry(event.target.value)}
            disabled={!canManage}
            className={inputClassName}
          >
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-slate-600">
          E-mails to receive invoices
        </legend>
        <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-slate-300 px-3 py-2">
          {invoiceEmails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-800"
            >
              {email}
              {canManage ? (
                <button
                  type="button"
                  aria-label={`Remove ${email}`}
                  onClick={() =>
                    setInvoiceEmails((current) =>
                      current.filter((item) => item !== email),
                    )
                  }
                  className="text-slate-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </span>
          ))}
          {canManage ? (
            <input
              type="email"
              value={emailDraft}
              onChange={(event) => setEmailDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addEmail();
                }
              }}
              onBlur={addEmail}
              placeholder="Add email"
              className="min-w-[160px] flex-1 border-0 bg-transparent py-1 text-sm outline-none"
            />
          ) : null}
        </div>
        {fieldErrors.invoiceEmails ? (
          <p className="mt-1 text-xs text-rose-600">
            {fieldErrors.invoiceEmails}
          </p>
        ) : null}
      </fieldset>

      {canManage ? (
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={loading || !dirty}
            className="inline-flex h-11 min-w-[148px] items-center justify-center rounded-md bg-[#2a1728] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          You can view billing information, but you need permission to change
          it.
        </p>
      )}
    </form>
  );
}
