"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ArrowRight, X } from "lucide-react";

import { cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import type { CoreCategory } from "@/lib/website/core-categories";
import { fill, homeCopy } from "@/lib/website/home-funnel";
import { SERVICE_MEDIA } from "@/lib/website/home-media";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { sectionId } from "./HomeSectionNav";

const COPY = {
  title: { en: "Your order", fr: "Votre commande" },
  close: { en: "Close", fr: "Fermer" },
  empty: { en: "Your order is empty. Add a service to start.", fr: "Votre commande est vide. Ajoutez un service pour commencer." },
  build: { en: "Build my plan", fr: "Composer mon forfait" },
  remove: { en: "Remove", fr: "Retirer" },
  steps: [
    { en: "Create your account", fr: "Créez votre compte" },
    { en: "Confirm and pay online", fr: "Confirmez et payez en ligne" },
    { en: "We set everything up with you", fr: "On met tout en place avec vous" },
  ],
  order: { en: "Create my account and order", fr: "Créer mon compte et commander" },
  hosting: { en: "Buy domain and hosting now", fr: "Acheter domaine et hébergement maintenant" },
  login: { en: "I already have an account", fr: "J’ai déjà un compte" },
  taxes: { en: "Prices in Canadian dollars. Taxes are calculated at checkout.", fr: "Prix en dollars canadiens. Les taxes sont calculées au paiement." },
} as const;

function linePrice(c: CoreCategory, tk: (k: string) => string, lang: "en" | "fr"): string {
  if (c.from === "quote") return tk("cat.onQuote");
  if (c.from === "planned") return tk("cat.planned");
  return `${money(lang, c.from.amount)}${cadenceSuffix(tk, c.from.cadence)}`;
}

/** The order pop-up: what is in the plan, the starting total, and the buttons to order. */
export function OrderSheet() {
  const { tk, lang } = useCopy();
  const plan = useHomePlan();
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = plan.orderOpen;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && plan.setOrderOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, plan]);

  if (!open) return null;
  const t = plan.totals;
  const rows = [
    { label: homeCopy.plan.monthly[lang], value: t.monthly },
    { label: homeCopy.plan.yearly[lang], value: t.yearly },
    { label: homeCopy.plan.oneTime[lang], value: t.oneTime },
  ].filter((r) => r.value > 0);
  const hasWebFoundation = plan.has("domains") || plan.has("hosting");

  // Portal to <body>: the page wrapper isolates its children, which would put the sheet under the site header.
  return createPortal(
    <div className="hp hp-portal fixed inset-0 z-[120] flex justify-end" data-theme={document.querySelector(".hp")?.getAttribute("data-theme") ?? "light"} role="dialog" aria-modal="true" aria-labelledby="order-title">
      <div className="tk-fade-in absolute inset-0 bg-[#05070C]/55 backdrop-blur-sm" onClick={() => plan.setOrderOpen(false)} aria-hidden />
      <aside className="hp-bg hp-sheet-in relative flex h-full w-full max-w-[460px] flex-col shadow-[-30px_0_80px_-30px_rgb(0_0_0/0.5)]">
        <header className="hp-line flex items-center justify-between border-b px-6 py-5">
          <h2 id="order-title" className="hp-display hp-ink text-[24px]">
            {COPY.title[lang]}
          </h2>
          <button ref={closeRef} type="button" onClick={() => plan.setOrderOpen(false)} aria-label={COPY.close[lang]} className="hp-ghost hp-focus grid h-10 w-10 place-items-center rounded-full">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {plan.categories.length ? (
            <ul className="hp-divide">
              {plan.categories.map((c) => {
                const media = SERVICE_MEDIA[c.key];
                return (
                  <li key={c.key} className="flex items-center gap-4 py-3.5">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl">
                      <Image src={media.photo} alt="" fill sizes="56px" className="object-cover" style={{ objectPosition: media.focus, transform: `scale(${media.zoom})` }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="hp-ink block text-[15px] font-semibold">{tk(`cat.${c.key}.name`)}</span>
                      <span className="hp-ink-2 block text-[13px] tabular-nums">{linePrice(c, tk, lang)}</span>
                    </span>
                    <button type="button" onClick={() => plan.toggle(c.key)} className="hp-ink-3 hp-focus rounded-full px-2 py-1 text-[12.5px] font-medium underline-offset-4 hover:text-[var(--hp-ink)] hover:underline">
                      {COPY.remove[lang]}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-10 text-center">
              <p className="hp-ink-2 text-[15px]">{COPY.empty[lang]}</p>
              <button
                type="button"
                onClick={() => {
                  plan.setOrderOpen(false);
                  document.getElementById(sectionId("plan"))?.scrollIntoView({ behavior: "smooth" });
                }}
                className="hp-btn hp-focus mt-5 rounded-full px-5 py-3 text-[14px] font-semibold"
              >
                {COPY.build[lang]}
              </button>
            </div>
          )}

          {plan.categories.length > 0 && (
            <>
              <dl className="hp-card mt-5 grid gap-2 rounded-2xl p-5">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-baseline justify-between gap-4">
                    <dt className="hp-ink-2 text-[14px]">{r.label}</dt>
                    <dd className="hp-display hp-ink text-[26px]">{money(lang, Math.round(r.value * 100) / 100)}</dd>
                  </div>
                ))}
                {t.quoted > 0 && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="hp-ink-2 text-[14px]">{fill(homeCopy.plan.quoted[lang], { n: t.quoted })}</dt>
                    <dd className="hp-ink-2 text-[14px]">{lang === "fr" ? "Sur mesure" : "Custom"}</dd>
                  </div>
                )}
              </dl>
              <ol className="mt-6 grid gap-3">
                {COPY.steps.map((s, i) => (
                  <li key={s.en} className="flex items-center gap-3">
                    <span className="hp-btn grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold">{i + 1}</span>
                    <span className="hp-ink text-[14.5px]">{s[lang]}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        {plan.categories.length > 0 && (
          <footer className="hp-line grid gap-2.5 border-t px-6 pb-6 pt-5">
            <Link to={plan.registerHref} className="hp-cta hp-halo hp-focus inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 text-[16px] font-semibold">
              {COPY.order[lang]} <ArrowRight size={17} aria-hidden />
            </Link>
            {hasWebFoundation && (
              <Link to="/checkout" className="hp-btn hp-focus inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold">
                {COPY.hosting[lang]}
              </Link>
            )}
            <Link to="/login" className="hp-ink-2 hp-focus py-1 text-center text-[13.5px] font-medium underline-offset-4 hover:text-[var(--hp-ink)] hover:underline">
              {COPY.login[lang]}
            </Link>
            <p className="hp-ink-3 text-center text-[12px]">{COPY.taxes[lang]}</p>
          </footer>
        )}
      </aside>
    </div>,
    document.querySelector(".website-surface") ?? document.body,
  );
}
