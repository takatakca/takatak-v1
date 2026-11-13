"use client";

import {
  ArrowRight,
  Bell,
  Check,
  ClipboardList,
  Cog,
  FileText,
  Filter,
  Globe,
  Hammer,
  Headset,
  LayoutGrid,
  LineChart,
  ListChecks,
  ListTree,
  MapPin,
  Megaphone,
  MessageSquare,
  Network,
  PenTool,
  Phone,
  RefreshCw,
  Rocket,
  Search,
  Server,
  ShieldCheck,
  Target,
  Users,
  Voicemail,
  type LucideIcon,
} from "lucide-react";

import { Reveal } from "@/components/website/home/Reveal";
import { money, NavyBackdrop } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import type { TranslationKey } from "@/lib/website/i18n";
import { Link } from "@/lib/website/nav";
import { cadenceKeys } from "@/lib/website/pricing";
import type { FlowKind, ServicePackage, ServicePage } from "@/lib/website/service-pages";
import { useLanguage } from "@/lib/website/use-language";

/** One icon per step, by the kind of work the service does. */
const STEP_ICONS: Record<FlowKind, readonly LucideIcon[]> = {
  domain: [Search, ShieldCheck, Network, Globe],
  hosting: [Server, ShieldCheck, LayoutGrid, Globe],
  website: [FileText, PenTool, Hammer, Rocket],
  design: [FileText, PenTool, RefreshCw, Rocket],
  marketing: [Target, Megaphone, Users, LineChart],
  local: [Search, MapPin, Network, LineChart],
  leads: [ClipboardList, Filter, Users, Bell],
  voip: [Phone, ListTree, Voicemail, LineChart],
  automation: [ListChecks, Cog, Bell, LineChart],
  marketplace: [ClipboardList, Users, LayoutGrid, Check],
};

function Section({ id, title, sub, tinted = false, children }: { id: string; title: string; sub?: string; tinted?: boolean; children: React.ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`relative py-16 sm:py-20 ${tinted ? "bg-[linear-gradient(180deg,rgb(11_27_61/0.55),rgb(11_27_61/0.25))]" : ""}`}
      style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 24px)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.06]" />
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mb-10 max-w-3xl">
          <h2 id={`${id}-title`} className="text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-[38px]">
            {title}
          </h2>
          {sub && <p className="mt-3 text-base leading-7 text-white/65">{sub}</p>}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

/** A service page for the services that have no category sales page: navy, layered, prices in the visitor's language. */
export function ServiceProductPage({ page }: { page: ServicePage }) {
  const { t, tx, lang } = useLanguage();
  const cheapest = page.packages.reduce((min, p) => (p.amount < min ? p.amount : min), page.packages[0]?.amount ?? 0);
  const icons = STEP_ICONS[page.flow];
  const talk = () => openLiveChat({ query: tx(page.title), intent: page.slug, page: page.route, lang });

  const unit = (p: ServicePackage) => {
    const cadence = t(cadenceKeys[p.cadence] as TranslationKey);
    const suffix = p.suffix ? (p.suffix === "+ ad spend" ? t("suffix.adSpend" as TranslationKey) : t("cat.suffix.plus" as TranslationKey)) : "";
    return [cadence, suffix].filter(Boolean).join(" ");
  };

  return (
    <article className="tk-page tk-premium brand-dark bg-[#060D1F] text-white">
      {/* Hero: the promise on the left, what is included on the right */}
      <section aria-labelledby="svc-title" className="relative overflow-hidden">
        <NavyBackdrop grid />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:pt-14 lg:grid-cols-12 lg:pb-20 lg:pt-20">
          <div className="lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75 ring-1 ring-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden /> {tx(page.eyebrow)}
            </p>
            <h1 id="svc-title" className="tk-gradient-text mt-6 text-balance text-[40px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-[56px]">
              {tx(page.title)}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-[17px]">{tx(page.tagline)}</p>
            {page.packages.length > 0 && (
              <p className="mt-6 inline-flex items-baseline gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[14px] text-white/70 ring-1 ring-white/10">
                {t("service.startingAt")} <span className="text-[18px] font-bold text-white">{money(lang, cheapest)}</span>
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={page.cta.to as never} className="tk-btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold">
                {tx(page.cta.label)} <ArrowRight size={16} aria-hidden />
              </Link>
              <button type="button" onClick={talk} className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold">
                <Headset size={16} aria-hidden /> {t("service.talkToTakatak")}
              </button>
              <Link to="/marketplace/post-project" className="inline-flex items-center gap-2 rounded-xl px-4 py-3.5 text-[15px] font-semibold text-white/80 hover:text-white">
                <MessageSquare size={16} aria-hidden /> {t("service.requestQuote")}
              </Link>
            </div>
          </div>
          <Reveal className="lg:col-span-5">
            <div className="tk-glass relative overflow-hidden rounded-[26px] p-6 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.8)] sm:p-7">
              <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#1E6BFF]/25 blur-3xl" />
              <p className="relative text-[12px] font-semibold uppercase tracking-[0.2em] text-sky-300">{t("service.benefits")}</p>
              <ul className="relative mt-5 grid gap-3">
                {page.benefits.map((b) => (
                  <li key={b.en} className="flex items-start gap-3 text-[15px] leading-6 text-white/85">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-400/15 text-sky-300">
                      <Check size={14} strokeWidth={2.6} aria-hidden />
                    </span>
                    {tx(b)}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* What it does, then the steps */}
      <Section id="svc-what" title={t("service.whatItDoes")} sub={tx(page.intro)} tinted>
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-white/55">{t("service.howItWorks")}</h3>
        <ol className="relative mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <span aria-hidden className="pointer-events-none absolute left-8 right-8 top-[42px] hidden h-px bg-[linear-gradient(90deg,transparent,rgb(41_195_255/0.45),transparent)] lg:block" />
          {page.steps.slice(0, 4).map((s, i) => {
            const Icon = icons[i] ?? Check;
            return (
              <li key={s.en}>
                <Reveal delay={i * 70} className="tk-glass relative h-full rounded-2xl p-5">
                  <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-[linear-gradient(135deg,#1F8BFF,#29C3FF)] text-white shadow-[0_10px_24px_-10px_rgb(31_139_255/0.8)]">
                    <Icon size={20} aria-hidden />
                  </span>
                  <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    {lang === "fr" ? "Étape" : "Step"} {i + 1}
                  </p>
                  <p className="mt-1 text-[16px] font-bold text-white">{tx(s)}</p>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </Section>

      {/* Packages, from the price list */}
      {page.packages.length > 0 && (
        <Section id="svc-packages" title={t("service.packages")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.packages.map((p, i) => (
              <Reveal key={p.key} delay={i * 70} className="tk-glass tk-lift flex flex-col rounded-2xl p-6">
                <p className="text-[15px] font-semibold text-white/85">{tx(p.name)}</p>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5 text-[34px] font-extrabold tracking-[-0.02em] text-white">
                  {money(lang, p.amount)}
                  {unit(p) && <span className="text-[14px] font-medium text-white/55">{unit(p)}</span>}
                </p>
                <Link to={page.cta.to as never} className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-sky-300 hover:underline">
                  {tx(page.cta.label)} <ArrowRight size={14} aria-hidden />
                </Link>
              </Reveal>
            ))}
          </div>
          <p className="mt-5 text-[13px] text-white/50">{t("service.cadNote")}</p>
        </Section>
      )}

      {/* FAQ */}
      {page.faq.length > 0 && (
        <Section id="svc-faq" title={t("service.faq")} tinted>
          <div className="grid max-w-3xl gap-3">
            {page.faq.map((f) => (
              <details key={f.q.en} className="tk-faq tk-glass group rounded-2xl px-5 py-4 open:bg-white/[0.06]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-semibold">
                  {tx(f.q)}
                  <ArrowRight size={16} className="shrink-0 rotate-90 text-white/50 transition-transform group-open:-rotate-90" aria-hidden />
                </summary>
                <p className="mt-3 text-[15px] leading-7 text-white/68">{tx(f.a)}</p>
              </details>
            ))}
          </div>
        </Section>
      )}

      {/* Closing call to action */}
      <section className="px-4 pb-20 pt-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0B1B3D,#1565D8_60%,#29C3FF)] p-8 text-center sm:p-12">
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">{t("cta.title")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[16px] leading-7 text-white/80">{t("cta.body")}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to={page.cta.to as never} className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[15px] font-bold text-[#0B1B3D] hover:bg-blue-50">
              {tx(page.cta.label)} <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/services" className="inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold text-white ring-1 ring-white/50 hover:bg-white/10">
              {t("service.seeAll")}
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold text-white ring-1 ring-white/50 hover:bg-white/10">
              {t("common.viewPricing")}
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
