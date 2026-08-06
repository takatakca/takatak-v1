import type { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  Repeat,
  Rocket,
  Server,
  Shield,
} from "lucide-react";

import { UpmindDomainSearch } from "@/components/website/domain/upmind-domain-search";
import { pricing } from "@/lib/website/pricing";

export const metadata: Metadata = {
  title: "Web Hosting — TAKATAK",
};

const features = [
  {
    icon: Rocket,
    title: "One-click WordPress",
    description:
      "Launch with guided setup.",
  },
  {
    icon: Shield,
    title: "AI security",
    description:
      "Continuous monitoring and hardening.",
  },
  {
    icon: Repeat,
    title: "Automatic backups",
    description:
      "Browseable backups with restore support.",
  },
  {
    icon: Server,
    title: "Free migrations",
    description:
      "Move your website with managed support.",
  },
];

export default function HostingPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold text-slate-950 md:text-5xl">
          Managed hosting that just works
        </h1>

        <p className="mt-4 text-slate-600">
          Fast hosting with migrations, backups,
          SSL, email readiness, and TAKATAK
          support.
        </p>

        <Link
          href="/register?next=/dashboard/web-hosting"
          className="mt-8 inline-flex rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white"
        >
          Continue to hosting setup
        </Link>
      </div>

      <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon;

          return (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <Icon
                className="text-emerald-700"
                size={22}
              />

              <h2 className="mt-3 font-semibold text-slate-950">
                {feature.title}
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-16">
        <div className="mx-auto mb-7 max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-slate-950 md:text-3xl">
            Pick a hosting plan
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Plans are billed in CAD and can be
            upgraded as your business grows.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pricing.hosting.map((plan) => (
            <article
              key={plan.key}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <h3 className="text-lg font-semibold text-slate-950">
                {plan.name}
              </h3>

              <p className="mt-3 text-3xl font-bold text-slate-950">
                ${plan.amount}
                <span className="text-sm font-medium text-slate-500">
                  /month
                </span>
              </p>

              <p className="mt-2 text-sm text-slate-600">
                {plan.description}
              </p>

              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                {plan.features.map(
                  (feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2"
                    >
                      <Check
                        size={15}
                        className="mt-0.5 text-emerald-700"
                      />

                      {feature}
                    </li>
                  ),
                )}
              </ul>

              <Link
                href={`/register?plan=${encodeURIComponent(
                  plan.key,
                )}&next=/dashboard/web-hosting`}
                className="mt-6 inline-flex w-full justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Choose {plan.name}
              </Link>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-16 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-950">
          Search a domain to bundle
        </h2>

        <UpmindDomainSearch />
      </div>
    </section>
  );
}