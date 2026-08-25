"use client";

import { Check, Repeat, Rocket, Server, Shield } from "lucide-react";
import { Link } from "@/lib/website/nav";
import { UpmindDomainSearch } from "@/components/website/domain/upmind-domain-search";
import { pricing } from "@/lib/website/pricing";
import { useLanguage } from "@/lib/website/use-language";

const features = [
  { icon: Rocket, title: "hostingPage.f1", desc: "hostingPage.f1d" },
  { icon: Shield, title: "hostingPage.f2", desc: "hostingPage.f2d" },
  { icon: Repeat, title: "hostingPage.f3", desc: "hostingPage.f3d" },
  { icon: Server, title: "hostingPage.f4", desc: "hostingPage.f4d" },
] as const;

export function HostingPageContent() {
  const { t } = useLanguage();

  return (
    <section className="mx-auto max-w-7xl px-4 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold text-foreground md:text-5xl">
          {t("hostingPage.title")}
        </h1>
        <p className="mt-4 text-muted-foreground">{t("hostingPage.body")}</p>
        <Link
          to="/register"
          search={{ next: "/dashboard/web-hosting" }}
          className="mt-8 inline-block rounded-lg px-6 py-3 font-semibold text-primary-foreground"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        >
          {t("hostingPage.cta")}
        </Link>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <div key={feature.title} className="rounded-2xl border border-border bg-card p-6">
            <feature.icon className="text-primary" size={22} />
            <h3 className="mt-3 font-semibold text-foreground">{t(feature.title)}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t(feature.desc)}</p>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <div className="mx-auto mb-6 max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            {t("hostingPage.plansTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("hostingPage.plansBody")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pricing.hosting.map((plan) => (
            <article
              key={plan.key}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-3 text-3xl font-bold text-foreground">
                ${plan.amount}
                <span className="text-sm font-medium text-muted-foreground">/month</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {plan.features.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check size={15} className="mt-0.5 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                search={{ plan: plan.key, next: "/dashboard/web-hosting" }}
                className="mt-6 inline-flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Choose {plan.name}
              </Link>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-16 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          {t("hostingPage.domainTitle")}
        </h2>
        <UpmindDomainSearch />
      </div>
    </section>
  );
}
