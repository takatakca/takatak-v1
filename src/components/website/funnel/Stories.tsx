"use client";

import { useState } from "react";
import { ArrowRight, Check, Plus } from "lucide-react";

import { DomainSearchDialog } from "@/components/website/premium/DomainSearchDialog";
import { money } from "@/components/website/premium/ui";
import type { CategoryKey } from "@/lib/website/core-categories";
import { homeV3 } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { pricing } from "@/lib/website/pricing";
import { useLanguage } from "@/lib/website/use-language";
import { MediaLoop } from "./MediaLoop";
import { Rise } from "./primitives";
import { MediaChip } from "./ServiceGallery";

/** A slim intent bar: pick what you want, one button takes you there. No icons, no boxes. */
export function QuickActions() {
  const { lang } = useLanguage();
  const [pick, setPick] = useState<string>(homeV3.quick.items[0].key);
  const [domainOpen, setDomainOpen] = useState(false);
  const item = homeV3.quick.items.find((i) => i.key === pick) ?? homeV3.quick.items[0];
  const start = lang === "fr" ? "Commencer" : "Start";
  return (
    <section aria-labelledby="home-quick-title" className="hp-bg pb-6 pt-14 sm:pt-20">
      <div className="mx-auto max-w-7xl px-4">
        <Rise>
          <h2 id="home-quick-title" className="hp-display hp-ink text-[26px] sm:text-[32px]">
            {homeV3.quick.title[lang]}
          </h2>
          <div className="hp-raised mt-6 flex flex-col gap-2 rounded-[28px] p-2 ring-1 ring-[var(--hp-line)] sm:flex-row sm:items-center sm:rounded-full">
            <div role="radiogroup" aria-label={homeV3.quick.title[lang]} className="tk-no-scrollbar flex flex-1 gap-1 overflow-x-auto">
              {homeV3.quick.items.map((i) => {
                const on = i.key === pick;
                return (
                  <button
                    key={i.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPick(i.key)}
                    className={`hp-focus shrink-0 whitespace-nowrap rounded-full px-4 py-3 text-[14.5px] font-medium transition-colors ${
                      on ? "hp-btn" : "hp-ink-2 hover:bg-[var(--hp-alt)] hover:text-[var(--hp-ink)]"
                    }`}
                  >
                    {i.label[lang]}
                  </button>
                );
              })}
            </div>
            {item.to === "domain" ? (
              <button type="button" onClick={() => setDomainOpen(true)} className="hp-cta hp-halo hp-focus inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold">
                {start} <ArrowRight size={16} aria-hidden />
              </button>
            ) : (
              <Link to={item.to} className="hp-cta hp-halo hp-focus inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold">
                {start} <ArrowRight size={16} aria-hidden />
              </Link>
            )}
          </div>
        </Rise>
      </div>
      <DomainSearchDialog open={domainOpen} onClose={() => setDomainOpen(false)} />
    </section>
  );
}

/** The one line of product UI floating over each story photo. */
function StoryCard({ story }: { story: (typeof homeV3.stories)[number]["key"] }) {
  const { lang } = useLanguage();
  const text =
    story === "online"
      ? `votrecommerce.ca · ${lang === "fr" ? "Disponible" : "Available"} · ${money(lang, pricing.domain.register.amount)}${lang === "fr" ? "/an" : "/yr"}`
      : story === "found"
        ? lang === "fr"
          ? "Nouvel avis Google · ★★★★★"
          : "New Google review · ★★★★★"
        : lang === "fr"
          ? "Campagne Meta · En cours"
          : "Meta campaign · Running";
  return <MediaChip text={text} className="!px-4 !py-2.5 !text-[13.5px]" />;
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
                <MediaLoop
                  photo={s.photo}
                  alt={s.alt[lang]}
                  videoKey={s.key === "online" ? "website" : s.key === "found" ? "local" : "marketing"}
                  sizes="(min-width: 1024px) 720px, 100vw"
                  className="aspect-[4/3] rounded-[28px] sm:aspect-[16/11]"
                />
                <div className={`absolute -bottom-5 ${reverse ? "right-4 sm:right-8" : "left-4 sm:left-8"}`}>
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
                    className={`hp-focus inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold ${all ? "hp-ghost" : "hp-cta hp-halo"}`}
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
