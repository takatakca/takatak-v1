"use client";

import {
  CheckCircle2,
  Globe2,
  LockKeyhole,
  Mail,
  Server,
} from "lucide-react";
import { Link } from "@/lib/website/nav";
import { UpmindDomainSearch } from "@/components/website/domain/upmind-domain-search";
import { useLanguage } from "@/lib/website/use-language";

const chips = [
  "domain.chip.ca",
  "domain.chip.dns",
  "domain.chip.email",
  "domain.chip.managed",
] as const;

export function DomainPageContent() {
  const { t } = useLanguage();

  return (
    <>
      <section className="brand-dark relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(var(--brand-dark-border) 1px, transparent 1px), linear-gradient(90deg, var(--brand-dark-border) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 md:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Globe2 size={14} className="text-primary" /> {t("domain.badge")}
            </div>
            <h1 className="mt-5 max-w-xl text-4xl font-bold leading-tight text-foreground md:text-6xl">
              {t("domain.title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              {t("domain.body")}
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-2">
              {chips.map((key) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card/35 px-3 py-2 text-foreground/90"
                >
                  <CheckCircle2 size={15} className="shrink-0 text-primary" /> {t(key)}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-background/95 p-3 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.75)] sm:p-4">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {t("domain.desk.eyebrow")}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                {t("domain.desk.title")}
              </h2>
              <div className="mt-5">
                <UpmindDomainSearch />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 px-1 pt-4 text-xs text-muted-foreground sm:grid-cols-3">
              <span className="inline-flex items-center gap-2">
                <LockKeyhole size={14} className="text-primary" /> Protected account flow
              </span>
              <span className="inline-flex items-center gap-2">
                <Mail size={14} className="text-primary" /> Email setup ready
              </span>
              <span className="inline-flex items-center gap-2">
                <Server size={14} className="text-primary" /> Hosting compatible
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-3">
        <Link
          to="/hosting"
          className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50"
        >
          <p className="font-semibold text-foreground">Bundle with hosting</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your domain to WordPress, SSL, cPanel, and email.
          </p>
        </Link>
        <Link
          to="/services/websites"
          className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50"
        >
          <p className="font-semibold text-foreground">Launch a website</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn the new domain into a professional TAKATAK build.
          </p>
        </Link>
        <Link
          to="/dashboard/support"
          className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50"
        >
          <p className="font-semibold text-foreground">Need help choosing?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            TAKATAK can review names before registration.
          </p>
        </Link>
      </section>
    </>
  );
}
