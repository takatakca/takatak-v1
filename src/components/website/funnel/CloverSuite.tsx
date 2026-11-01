"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Banknote,
  BarChart3,
  Bike,
  Check,
  Clock3,
  CreditCard,
  Gift,
  Hand,
  MessageCircle,
  Percent,
  Phone,
  Send,
  Star,
} from "lucide-react";

import { SUITE_GROUPS, type SuiteProduct } from "@/lib/website/home-funnel";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { useSeen } from "./primitives";

type Lang = "fr" | "en";
export type F = 0 | 1 | 2 | 3;

export const APPS = SUITE_GROUPS.flatMap((g) => g.products).filter((p) => p.status === "clover" || p.key === "ch4t");

/** Each app's colour on its mini screen (the app's own accent, not a status). */
export const ACCENT: Record<string, string> = {
  c4isse: "#1F8BFF",
  t4ctile: "#E5484D",
  "4ccounting": "#12A150",
  tr4cker: "#F59E0B",
  st4ff: "#8B5CF6",
  m4rketing: "#EC4899",
  loy4lty: "#29C3FF",
  rew4rd: "#F97316",
  ch4t: "#14B8A6",
};

const w = (lang: Lang, fr: string, en: string) => (lang === "fr" ? fr : en);

function Done({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <span
      className={`absolute inset-x-1.5 bottom-1.5 flex items-center gap-1 rounded-md bg-emerald-500 px-1.5 py-1 text-[9.5px] font-bold text-white transition-all duration-300 ${
        show ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <Check size={10} strokeWidth={3.5} aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

function Tap({ show, className }: { show: boolean; className: string }) {
  return (
    <span aria-hidden className={`absolute transition-all duration-300 ${show ? "scale-100 opacity-100" : "scale-50 opacity-0"} ${className}`}>
      <span className="absolute -inset-1.5 animate-ping rounded-full bg-white/50" />
      <Hand size={14} className="relative fill-white text-[#0B1220]" />
    </span>
  );
}

/** One app's moving mini screen: four frames that loop like a GIF. */
export function Mini({ app, f, lang }: { app: string; f: F; lang: Lang }) {
  const a = ACCENT[app] ?? "#1F8BFF";
  const box = "relative h-full w-full overflow-hidden rounded-[10px] bg-white text-[#0B1220]";
  switch (app) {
    case "c4isse":
      return (
        <div className={box}>
          <p className="px-2 pt-1.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: a }}>
            {w(lang, "Comptoir", "Counter")}
          </p>
          <ul className="grid gap-0.5 px-2 pt-1 text-[9.5px]">
            {[w(lang, "Café", "Coffee"), w(lang, "Croissant", "Croissant"), w(lang, "Jus", "Juice")].map((l, i) => (
              <li key={l} className={`flex justify-between transition-opacity duration-300 ${f >= i || f === 3 ? "opacity-100" : "opacity-0"}`}>
                {l}
                <span className="h-1.5 w-6 self-center rounded bg-slate-200" />
              </li>
            ))}
          </ul>
          <div className="mx-2 mt-1 flex items-center justify-between border-t border-dashed border-slate-200 pt-1 text-[9px] text-slate-500">
            {w(lang, "TPS + TVQ", "GST + QST")}
            <CreditCard size={11} style={{ color: a }} aria-hidden />
          </div>
          <span
            className="absolute -bottom-1 right-2 grid h-4 w-10 place-items-center rounded-t bg-slate-700 transition-transform duration-500"
            style={{ transform: f === 3 ? "translateY(-4px)" : "translateY(4px)" }}
            aria-hidden
          >
            <Banknote size={9} className="text-emerald-300" />
          </span>
          <Done show={f === 3}>{w(lang, "Payé · tiroir ouvert", "Paid · drawer open")}</Done>
        </div>
      );
    case "t4ctile":
      return (
        <div className={box}>
          <p className="px-2 py-1 text-[9px] font-bold text-white" style={{ background: a }}>
            {w(lang, "Commandez ici", "Order here")}
          </p>
          <div className="grid grid-cols-2 gap-1 p-1.5">
            {["#FDE68A", "#FECACA", "#BBF7D0", "#BFDBFE"].map((c, i) => (
              <span
                key={c}
                className="h-5 rounded transition-all duration-300"
                style={{ background: c, outline: f === 1 && i === 1 ? `2px solid ${a}` : "none", transform: f === 1 && i === 1 ? "scale(0.94)" : "none" }}
              />
            ))}
          </div>
          <span className={`mx-1.5 block rounded py-1 text-center text-[9px] font-bold text-white transition-transform duration-200 ${f === 2 ? "scale-95" : ""}`} style={{ background: a }}>
            {w(lang, "Commander", "Order")}
            {f >= 2 && <span className="ml-1 rounded-full bg-white px-1 text-[8px]" style={{ color: a }}>1</span>}
          </span>
          <Tap show={f === 1} className="left-[62%] top-[34%]" />
          <Tap show={f === 2} className="left-[46%] top-[70%]" />
          <Done show={f === 3}>{w(lang, "Envoyé en cuisine", "Sent to the kitchen")}</Done>
        </div>
      );
    case "4ccounting":
      return (
        <div className={box}>
          <p className="flex items-center gap-1 px-2 pt-1.5 text-[9px] font-bold" style={{ color: a }}>
            <BarChart3 size={10} aria-hidden /> {w(lang, "Ventes du jour", "Today's sales")}
          </p>
          <div className="flex h-9 items-end gap-1 px-2 pt-1" aria-hidden>
            {[45, 70, 55, 90, 65].map((h, i) => (
              <span key={i} className="flex-1 rounded-t transition-all duration-500" style={{ height: f >= 1 ? `${h}%` : "8%", background: a, opacity: 0.35 + i * 0.13, transitionDelay: `${i * 60}ms` }} />
            ))}
          </div>
          <div className={`mx-2 mt-1 grid gap-0.5 text-[9px] text-slate-600 transition-opacity duration-300 ${f >= 2 ? "opacity-100" : "opacity-0"}`}>
            <span className="flex justify-between">{w(lang, "TPS · TVQ", "GST · QST")}<span className="h-1.5 w-7 self-center rounded bg-slate-200" /></span>
            <span className="flex justify-between">{w(lang, "Pourboires", "Tips")}<span className="h-1.5 w-5 self-center rounded bg-slate-200" /></span>
          </div>
          <Done show={f === 3}>{w(lang, "Export comptable prêt", "Accounting export ready")}</Done>
        </div>
      );
    case "tr4cker": {
      const pos = [
        { l: "14%", t: "70%" },
        { l: "38%", t: "52%" },
        { l: "62%", t: "40%" },
        { l: "76%", t: "24%" },
      ][f];
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[10px] bg-[#E8EEF7]">
          <svg viewBox="0 0 100 70" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
            <path d="M0 50 L100 30 M30 0 L45 70 M70 0 L62 70" stroke="#fff" strokeWidth="5" />
            <path d="M14 52 Q30 40 40 38 T76 16" fill="none" stroke={a} strokeWidth="2" strokeDasharray="3 2" />
          </svg>
          <span className="absolute grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white shadow transition-all duration-700" style={{ left: pos.l, top: pos.t, background: a }}>
            <Bike size={11} aria-hidden />
          </span>
          <span className="absolute right-2 top-1.5 rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 shadow-sm">
            <Clock3 size={9} className="mr-0.5 inline" aria-hidden />
            {f === 3 ? w(lang, "Arrivé", "Arrived") : w(lang, "En route", "On the way")}
          </span>
          <Done show={f === 3}>{w(lang, "Livré · pourboire et avis", "Delivered · tip and review")}</Done>
        </div>
      );
    }
    case "st4ff":
      return (
        <div className={box}>
          <p className="px-2 pt-1.5 text-[9px] font-bold" style={{ color: a }}>{w(lang, "Quarts de la semaine", "This week's shifts")}</p>
          <div className="grid gap-1 px-2 pt-1.5" aria-hidden>
            {[
              { k: w(lang, "Cuisine", "Kitchen"), s: 5, e: 75 },
              { k: w(lang, "Comptoir", "Counter"), s: 20, e: 90 },
              { k: w(lang, "Livraison", "Delivery"), s: 40, e: 95 },
            ].map((r, i) => (
              <span key={r.k} className="flex items-center gap-1 text-[8.5px] text-slate-500">
                <span className="w-9 truncate">{r.k}</span>
                <span className="relative h-2 flex-1 rounded bg-slate-100">
                  <span className="absolute inset-y-0 rounded transition-all duration-500" style={{ left: `${r.s}%`, right: f >= i + 1 || f === 3 ? `${100 - r.e}%` : `${100 - r.s - 4}%`, background: a }} />
                </span>
              </span>
            ))}
          </div>
          <p className={`mx-2 mt-1.5 text-[9px] font-semibold text-slate-700 transition-opacity duration-300 ${f >= 2 ? "opacity-100" : "opacity-0"}`}>
            {w(lang, "Coût de main-d’œuvre", "Labour cost")} <Percent size={9} className="inline" aria-hidden />
          </p>
          <Done show={f === 3}>{w(lang, "Horaire publié", "Schedule published")}</Done>
        </div>
      );
    case "m4rketing":
      return (
        <div className={box}>
          <p className="px-2 pt-1.5 text-[9px] font-bold" style={{ color: a }}>{w(lang, "Nouvelle campagne", "New campaign")}</p>
          <div className="grid gap-1 px-2 pt-1 text-[9px]">
            <span className={`rounded px-1.5 py-0.5 transition-all duration-300 ${f >= 1 ? "text-white" : "bg-slate-100 text-slate-500"}`} style={f >= 1 ? { background: a } : undefined}>
              {w(lang, "Segment : clients fidèles", "Segment: loyal customers")}
            </span>
            <span className={`flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 transition-opacity duration-300 ${f >= 2 ? "opacity-100" : "opacity-0"}`}>
              <Percent size={9} aria-hidden /> {w(lang, "Rabais Clover · -10 %", "Clover discount · -10%")}
            </span>
          </div>
          <span className={`absolute right-2 top-1.5 transition-transform duration-500 ${f === 3 ? "-translate-y-1 translate-x-1" : ""}`} aria-hidden>
            <Send size={11} style={{ color: a }} />
          </span>
          <Done show={f === 3}>{w(lang, "Envoyée, avec consentement", "Sent, with consent")}</Done>
        </div>
      );
    case "loy4lty":
      return (
        <div className={box}>
          <p className="flex items-center gap-1 px-2 pt-1.5 text-[9px] font-bold" style={{ color: a }}>
            <Phone size={9} aria-hidden /> {w(lang, "Votre numéro", "Your number")}
          </p>
          <p className="px-2 font-mono text-[11px] tracking-wider text-slate-800">{f === 0 ? "514 ___" : "514 •••• ••"}</p>
          <div className="mt-1 flex gap-1 px-2" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="grid h-4 w-4 place-items-center rounded-full border transition-colors duration-300" style={{ borderColor: a, background: i < (f >= 2 ? 5 : 4) ? a : "transparent" }}>
                {i < (f >= 2 ? 5 : 4) && <Star size={8} className="fill-white text-white" />}
              </span>
            ))}
          </div>
          <p className={`px-2 pt-1 text-[9px] font-semibold transition-opacity duration-300 ${f >= 2 ? "opacity-100" : "opacity-0"}`} style={{ color: a }}>
            +1 {w(lang, "point", "point")}
          </p>
          <Done show={f === 3}>{w(lang, "Récompense débloquée", "Reward unlocked")}</Done>
        </div>
      );
    case "rew4rd":
      return (
        <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-[10px] bg-[#FFF7ED]" style={{ perspective: 400 }}>
          <span
            className="relative grid h-[58%] w-[78%] place-items-center rounded-lg text-white shadow-lg transition-transform duration-700"
            style={{ background: `linear-gradient(135deg, ${a}, #B45309)`, transform: f === 1 || f === 2 ? "rotateY(180deg)" : "none", transformStyle: "preserve-3d" }}
          >
            <span className="flex items-center gap-1 text-[10px] font-bold" style={{ backfaceVisibility: "hidden" }}>
              <Gift size={12} aria-hidden /> {w(lang, "Carte-cadeau", "Gift card")}
            </span>
            <span className="absolute inset-0 grid place-items-center rounded-lg text-[9px] font-semibold" style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}>
              {w(lang, "Solde rechargeable", "Reloadable balance")}
            </span>
          </span>
          <Done show={f === 3}>{w(lang, "Payé en partie avec la carte", "Part paid with the card")}</Done>
        </div>
      );
    case "ch4t":
    default:
      return (
        <div className={`${box} bg-[#F4F7FC] p-1.5`}>
          <span className="block max-w-[80%] rounded-lg rounded-bl-sm bg-white px-1.5 py-1 text-[9px] text-slate-700 shadow-sm">
            {w(lang, "Où est ma commande ?", "Where is my order?")}
          </span>
          <span
            className={`ml-auto mt-1 block max-w-[80%] rounded-lg rounded-br-sm px-1.5 py-1 text-[9px] text-white transition-all duration-300 ${f >= 2 ? "opacity-100" : "opacity-0"}`}
            style={{ background: a }}
          >
            {w(lang, "Clover · commande #108 en route", "Clover · order #108 on its way")}
          </span>
          {f === 1 && (
            <span className="ml-auto mt-1 flex w-8 justify-center gap-0.5 rounded-lg bg-white py-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </span>
          )}
          <MessageCircle size={10} className="absolute right-1.5 top-1.5" style={{ color: a }} aria-hidden />
          <Done show={f === 3}>{w(lang, "Réglé, avec le contexte Clover", "Solved, with Clover context")}</Done>
        </div>
      );
  }
}

/** The nine Clover apps, each with its moving mini screen beside it. */
export function CloverSuite({ statusLabel }: { statusLabel: ReactNode }) {
  const { lang } = useLanguage();
  const reduced = useReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced || !seen) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1250);
    return () => window.clearInterval(id);
  }, [reduced, seen]);

  return (
    <div ref={ref} className="relative z-[2] mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {APPS.map((p: SuiteProduct, i) => {
        // Each card runs a beat behind the previous one, so they never flip together.
        const f = (reduced ? 3 : (tick + i * 3) % 4) as F;
        return (
          <a
            key={p.key}
            href={`/clover#${p.key}`}
            className="group/app flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-[var(--hp-line)] transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-22px_var(--hp-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hp-info)]"
          >
            <div
              className="h-[92px] w-[120px] shrink-0 rounded-[14px] p-1 shadow-[0_10px_24px_-14px_rgb(6_13_31/0.7)]"
              style={{ background: `linear-gradient(160deg, #1B2436, #0B1220)` }}
              aria-hidden
            >
              <Mini app={p.key} f={f} lang={lang} />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[14px] font-extrabold tracking-[0.06em] hp-ink">
                <span className="h-2 w-2 rounded-full" style={{ background: ACCENT[p.key] }} aria-hidden />
                {p.name}
              </p>
              <p className="mt-0.5 text-[13px] leading-5 hp-ink-2">{p.desc[lang]}</p>
            </div>
          </a>
        );
      })}
      <div className="sm:col-span-2 lg:col-span-3">{statusLabel}</div>
    </div>
  );
}
