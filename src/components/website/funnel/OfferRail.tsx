"use client";

import Image from "next/image";
import { ArrowRight, Check, Headset, Mic, MessageSquareText, Plus, Sparkles } from "lucide-react";

import { cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { CORE_CATEGORIES } from "@/lib/website/core-categories";
import { SERVICE_MEDIA } from "@/lib/website/home-media";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";

/** Opens the homepage sales assistant (AskBar's concierge) from anywhere. */
export const CONCIERGE_OPEN_EVENT = "concierge:open";
export function openConcierge(detail: { first?: string; voice?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent(CONCIERGE_OPEN_EVENT, { detail }));
}

const T = {
  title: { fr: "Choisissez, ajoutez, on s'occupe du reste.", en: "Pick, add, we handle the rest." },
  ai: {
    eyebrow: { fr: "Assistant ventes IA", en: "AI sales assistant" },
    title: { fr: "Votre projet, vos prix, en 2 minutes.", en: "Your project, your prices, in 2 minutes." },
    body: {
      fr: "Dites-moi ce que vous voulez faire : je vous montre les bons services, les vrais prix, et je prépare votre demande.",
      en: "Tell me what you want to do: I show the right services, the real prices, and prepare your request.",
    },
    write: { fr: "Écrire", en: "Type" },
    talk: { fr: "Parler", en: "Talk" },
    human: { fr: "Un humain", en: "A person" },
  },
  add: { fr: "Ajouter", en: "Add" },
  added: { fr: "Ajouté", en: "Added" },
  more: { fr: "Voir plus", en: "See more" },
  ask: { fr: "Demander un prix", en: "Ask for a price" },
} as const;

/** Starting prices from the catalog as real offers, next to the AI sales assistant. */
export function OfferRail() {
  const { tk, lang } = useCopy();
  const plan = useHomePlan();
  const priced = CORE_CATEGORIES.filter((c) => typeof c.from === "object");

  return (
    <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-4">
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* The AI sales assistant, always beside the offers */}
        <div className="hp-glow relative overflow-hidden rounded-[22px] bg-[linear-gradient(150deg,#0B3BFF_0%,#1E6BFF_45%,#29C3FF_100%)] p-5 text-white shadow-[0_30px_80px_-30px_rgb(30_107_255/0.9)]">
          <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/85">
            <span className="relative grid h-7 w-7 place-items-center rounded-full bg-white/20">
              <Sparkles size={14} aria-hidden />
              <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1E6BFF]" />
            </span>
            {T.ai.eyebrow[lang]}
          </p>
          <p className="hp-display mt-3 text-[24px] leading-tight">{T.ai.title[lang]}</p>
          <p className="mt-2 text-[14px] leading-6 text-white/85">{T.ai.body[lang]}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => openConcierge()} className="flex flex-col items-center gap-1 rounded-2xl bg-white px-2 py-2.5 text-[12.5px] font-semibold text-[#0B1B3F] transition-transform hover:scale-[1.04]">
              <MessageSquareText size={17} aria-hidden /> {T.ai.write[lang]}
            </button>
            <button type="button" onClick={() => openConcierge({ voice: true })} className="flex flex-col items-center gap-1 rounded-2xl bg-white/15 px-2 py-2.5 text-[12.5px] font-semibold ring-1 ring-white/30 transition-transform hover:scale-[1.04]">
              <Mic size={17} aria-hidden /> {T.ai.talk[lang]}
            </button>
            <button
              type="button"
              onClick={() => openLiveChat({ page: "/", intent: "sales", lang })}
              className="flex flex-col items-center gap-1 rounded-2xl bg-white/15 px-2 py-2.5 text-[12.5px] font-semibold ring-1 ring-white/30 transition-transform hover:scale-[1.04]"
            >
              <Headset size={17} aria-hidden /> {T.ai.human[lang]}
            </button>
          </div>
        </div>

        {/* Offers: real starting prices, add in one click, or see the service */}
        <div className="min-w-0">
          <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {priced.map((c, i) => {
              const from = c.from as { amount: number; cadence: Parameters<typeof cadenceSuffix>[1]; prefixKey: string };
              const media = SERVICE_MEDIA[c.key];
              const on = plan.has(c.key);
              return (
                <li key={c.key} className="hp-glow group relative flex w-[248px] shrink-0 snap-start flex-col overflow-hidden rounded-[22px] bg-white/[0.05] ring-1 ring-white/10">
                  <div className="relative h-[104px] overflow-hidden">
                    <Image
                      src={media.photo}
                      alt=""
                      fill
                      sizes="248px"
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      style={{ objectPosition: media.focus }}
                    />
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#050B1A] via-[#050B1A]/30 to-transparent" />
                    <span className="hp-chip-flash absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#050B1A]/70 px-2.5 py-1 text-[11px] font-semibold text-[#7FD8FF] backdrop-blur" style={{ animationDelay: `${i * 0.9}s` }}>
                      <Sparkles size={11} aria-hidden /> {tk(from.prefixKey)}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-4 pt-1">
                    <p className="text-[15.5px] font-semibold text-white">{tk(`cat.${c.key}.name`)}</p>
                    <p className="mt-1 flex items-baseline gap-1">
                      <span className="hp-display text-[30px] leading-none text-white">{money(lang, from.amount)}</span>
                      <span className="text-[13px] text-white/55">{cadenceSuffix(tk, from.cadence)}</span>
                    </p>
                    <div className="mt-auto flex items-center gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => plan.toggle(c.key)}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${on ? "bg-emerald-500 text-white" : "bg-white text-[#050B1A] hover:bg-[#DCEBFF]"}`}
                      >
                        {on ? <Check size={14} strokeWidth={3} aria-hidden /> : <Plus size={14} strokeWidth={3} aria-hidden />}
                        {on ? T.added[lang] : T.add[lang]}
                      </button>
                      <Link to={c.route} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-semibold text-white/80 ring-1 ring-white/15 hover:text-white">
                        {T.more[lang]} <ArrowRight size={13} aria-hidden />
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => openConcierge({ first: `${tk(`cat.${c.key}.name`)} — ${T.ask[lang].toLowerCase()}` })}
                      className="mt-2 inline-flex items-center gap-1.5 self-start text-[12.5px] font-semibold text-[#7FD8FF] hover:text-white"
                    >
                      <Sparkles size={12} aria-hidden /> {T.ask[lang]}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
