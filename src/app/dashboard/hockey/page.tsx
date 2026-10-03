import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BellRing,
  CalendarDays,
  CarFront,
  Check,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

import { HockeyMembershipActions } from "@/components/hockey/hockey-membership-actions";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { getHockeyMembershipSnapshot } from "@/lib/billing/hockey/membership-service";
import { isHockeyMembershipCheckoutLive } from "@/lib/billing/hockey/stripe-env";

export const dynamic = "force-dynamic";

const MEMBER_FEATURES = [
  {
    icon: ShieldCheck,
    title: "Ad-free member experience",
    detail:
      "Premium AHMV surfaces can suppress AdSense after membership is verified by TAKATAK.",
  },
  {
    icon: Sparkles,
    title: "Premium AHMV assistant",
    detail:
      "The assistant can become the member gateway for team information, links and guided actions.",
  },
  {
    icon: BellRing,
    title: "Game reminders",
    detail:
      "Membership includes the entitlement required for future verified game and schedule reminders.",
  },
  {
    icon: CalendarDays,
    title: "Calendar sync",
    detail:
      "The member plan includes calendar-sync entitlement for selected teams and official events.",
  },
  {
    icon: Users,
    title: "Team community",
    detail:
      "Private team-community access can be enabled behind verified team membership and moderation.",
  },
  {
    icon: MessageCircle,
    title: "Parent messaging",
    detail:
      "Member-to-member communication is entitlement-gated and will not expose private contact data publicly.",
  },
  {
    icon: CarFront,
    title: "Parent rideshare",
    detail:
      "The member plan reserves access for opt-in parent rideshare coordination once that module is launched.",
  },
] as const;

export default async function HockeyMembershipPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard/hockey");

  const membership = await getHockeyMembershipSnapshot(user.id);
  const checkoutLive = isHockeyMembershipCheckoutLive();
  const paid = membership.access === "paid";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-400">
              GROUPE TAKATAK · Hockey membership
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              AHMV premium family experience
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              One TAKATAK identity for the paid AHMV member layer: no ads,
              premium assistant access, reminders, calendar sync, private team
              community and future parent rideshare.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <HockeyMembershipActions paid={paid} checkoutLive={checkoutLive} />
              <Link
                href="https://ahmverdun.ca"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Open AHM Verdun
              </Link>
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/[0.04] p-6 lg:border-l lg:border-t-0 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white">
                <Trophy className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  Current access
                </p>
                <p className="text-xl font-semibold">
                  {paid ? membership.planName ?? "AHMV Member" : "Not subscribed"}
                </p>
              </div>
            </div>

            <dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-400">Status</dt>
                <dd className="font-medium text-white">
                  {membership.status ?? "No membership"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-400">Weekly price</dt>
                <dd className="font-medium text-white">
                  {membership.displayWeeklyCad !== null
                    ? `$${membership.displayWeeklyCad.toFixed(2)} CAD`
                    : "$10.00 CAD"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-400">Ad-free entitlement</dt>
                <dd className="font-medium text-white">
                  {membership.features.includes("ad_free") ? "Active" : "Locked"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-400">Assistant entitlement</dt>
                <dd className="font-medium text-white">
                  {membership.features.includes("ai_assistant")
                    ? "Active"
                    : "Locked"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">
              AHMV Member
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              $10 CAD / week
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Before applicable taxes · cancel through Stripe portal
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MEMBER_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-xl border border-slate-200 p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold text-slate-950">
                    {feature.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {feature.detail}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Planned · not for sale
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              AHMV VIP · $30 CAD / week
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Reserved for the later travel/tournament, advanced family
              coordination and live experience layer. TAKATAK will not expose a
              self-serve checkout until those promised capabilities are actually
              delivered.
            </p>
          </div>
        </div>
      </section>

      {paid ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex gap-3">
            <Check className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
            <p className="text-sm leading-6 text-emerald-900">
              Your premium rights are derived from the TAKATAK backend and
              Stripe webhook state. A checkout success page alone never grants
              access.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
