"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { ArrowRight, AtSign, Bot, Check, LayoutTemplate, Megaphone, Plus, Server, ShieldCheck, Star, TrendingUp } from "lucide-react";

import { DomainSearchDialog } from "@/components/website/premium/DomainSearchDialog";
import { money } from "@/components/website/premium/ui";
import type { CategoryKey } from "@/lib/website/core-categories";
import { homeV3 } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { pricing } from "@/lib/website/pricing";
import { useLanguage } from "@/lib/website/use-language";
import { Rise } from "./primitives";

const QUICK_ICONS = {
  website: LayoutTemplate,
  domain: AtSign,
  hosting: Server,
  customers: Megaphone,
  reviews: Star,
  takbot: Bot,
} as const;

/** Uber-style suggestions: the six things people come here to do, one tap each. */
export function QuickActions() {
  const { lang } = useLanguage();
  const [domainOpen, setDomainOpen] = useState(false);
  return (
    <section aria-labelledby="home-quick-title" className="hp-bg pb-4 pt-16 sm:pt-20">
      <div className="mx-auto max-w-7xl px-4">
        <h2 id="home-quick-title" className="hp-display hp-ink text-[28px] sm:text-[34px]">
          {homeV3.quick.title[lang]}
        </h2>
        <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {homeV3.quick.items.map((item, i) => {
            const Icon = QUICK_ICONS[item.icon];
            const inner = (
              <>
                <Icon size={30} strokeWidth={1.6} className="hp-ink" aria-hidden />
                <span className="mt-auto flex items-end justify-between gap-2 pt-8">
                  <span className="hp-ink text-[15px] font-semibold leading-5">{item.label[lang]}</span>
                  <ArrowRight size={16} className="hp-ink-3 shrink-0 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </span>
              </>
            );
            const cls =
              "group hp-card hp-focus flex h-full min-h-[148px] flex-col rounded-2xl p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--hp-shadow)]";
            return (
              <Rise as="li" key={item.key} delay={i * 50}>
                {item.to === "domain" ? (
                  <button type="button" onClick={() => setDomainOpen(true)} className={`${cls} w-full`}>
                    {inner}
                  </button>
                ) : (
                  <Link to={item.to} className={cls}>
                    {inner}
                  </Link>
                )}
              </Rise>
            );
          })}
        </ul>
      </div>
      <DomainSearchDialog open={domainOpen} onClose={() => setDomainOpen(false)} />
    </section>
  );
}

/** A small product card floating over each story photo: what the service looks like in use. */
function StoryCard({ story }: { story: (typeof homeV3.stories)[number]["key"] }) {
  const { lang } = useLanguage();
  const card = (icon: ReactNode, title: string, sub: string) => (
    <div className="hp-raised flex items-center gap-3 rounded-2xl px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--hp-cta)] text-white">{icon}</span>
      <span className="min-w-0">
        <span className="hp-ink block truncate text-[14px] font-semibold">{title}</span>
        <span className="hp-ink-2 block truncate text-[12.5px]">{sub}</span>
      </span>
    </div>
  );
  if (story === "online") {
    return card(
      <ShieldCheck size={18} aria-hidden />,
      "votrecommerce.ca",
      `${lang === "fr" ? "Disponible" : "Available"} · ${money(lang, pricing.domain.register.amount)}${lang === "fr" ? "/an" : "/yr"}`,
    );
  }
  if (story === "found") {
    return card(
      <Star size={18} className="fill-white" aria-hidden />,
      lang === "fr" ? "Nouvel avis Google" : "New Google review",
      "★★★★★",
    );
  }
  return card(<TrendingUp size={18} aria-hidden />, lang === "fr" ? "Campagne Meta active" : "Meta campaign live", lang === "fr" ? "Mesurée dans votre tableau de bord" : "Measured in your dashboard");
}

/** Three photo stories: real people running real businesses, each tied to services you can add. */
export function PhotoStories() {
  const { lang } = useLanguage();
  const plan = useHomePlan();
  return (
    <div className="hp-bg py-10 sm:py-16">
      <div className="mx-auto grid max-w-7xl gap-16 px-4 sm:gap-24">
        {homeV3.stories.map((s, i) => {
          const keys = s.keys as readonly CategoryKey[];
          const all = keys.every((k) => plan.has(k));
          const reverse = i % 2 === 1;
          return (
            <article key={s.key} className="grid items-center gap-8 lg:grid-cols-12 lg:gap-16">
              <Rise className={`relative lg:col-span-7 ${reverse ? "lg:order-2" : ""}`}>
                <div className="group">
                  <div className="hp-photo aspect-[4/3] rounded-[28px] sm:aspect-[16/11]">
                    <Image src={s.photo} alt={s.alt[lang]} fill sizes="(min-width: 1024px) 720px, 100vw" className="object-cover" />
                  </div>
                </div>
                <div className={`absolute -bottom-6 w-[min(300px,80%)] ${reverse ? "right-4 sm:-right-6" : "left-4 sm:-left-6"}`}>
                  <StoryCard story={s.key} />
                </div>
              </Rise>
              <Rise delay={120} className={`lg:col-span-5 ${reverse ? "lg:order-1" : ""}`}>
                <p className="hp-accent text-[13px] font-semibold">{s.eyebrow[lang]}</p>
                <h3 className="hp-display hp-ink mt-3 text-balance text-[32px] sm:text-[42px]">{s.title[lang]}</h3>
                <p className="hp-ink-2 mt-5 text-[17px] leading-8">{s.body[lang]}</p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    aria-pressed={all}
                    onClick={() => plan.set(all ? plan.keys.filter((k) => !keys.includes(k)) : Array.from(new Set([...plan.keys, ...keys])))}
                    className={`hp-focus inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold ${all ? "hp-ghost" : "hp-cta"}`}
                  >
                    {all ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
                    {all ? homeV3.added[lang] : homeV3.addAll[lang]}
                  </button>
                  <Link to={s.route} className="hp-ink hp-focus inline-flex items-center gap-1.5 rounded-full px-3 py-3.5 text-[15px] font-semibold underline-offset-4 hover:underline">
                    {s.more[lang]} <ArrowRight size={15} aria-hidden />
                  </Link>
                </div>
              </Rise>
            </article>
          );
        })}
      </div>
    </div>
  );
}
