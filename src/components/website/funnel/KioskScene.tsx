"use client";

import { useEffect, useState } from "react";
import { ChefHat, Hand, MonitorSmartphone, Store } from "lucide-react";

import { BRAND_ICONS } from "@/lib/website/brand-icons";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { useSeen } from "./primitives";

type Lang = "fr" | "en";

const MENU: { fr: string; en: string; price: string }[] = [
  { fr: "Poulet grillé", en: "Grilled chicken", price: "16,95" },
  { fr: "Frites maison", en: "House fries", price: "5,50" },
  { fr: "Poutine", en: "Poutine", price: "11,25" },
  { fr: "Salade César", en: "Caesar salad", price: "9,75" },
  { fr: "Wrap au poulet", en: "Chicken wrap", price: "12,50" },
  { fr: "Limonade", en: "Lemonade", price: "3,95" },
];

/** Where orders come from: delivery apps through Food Hub, the kiosk, the Clover counter. */
const SOURCES: { key: string; name: string; icon?: string; Icon?: typeof Store }[] = [
  { key: "doordash", name: "DoorDash", icon: "doordash" },
  { key: "ubereats", name: "Uber Eats", icon: "ubereats" },
  { key: "skip", name: "Skip" },
  { key: "kiosk", name: "T4CTILE", Icon: MonitorSmartphone },
  { key: "counter", name: "Clover · C4ISSE", Icon: Store },
];

/** Kiosk accent colours: the restaurant picks its own brand. */
const BRANDS = ["#1E6BFF", "#E5484D", "#12A150", "#F59E0B"];

const T = {
  demo: { fr: "Démonstration", en: "Demo" },
  kiosk: { fr: "Borne libre-service", en: "Self-service kiosk" },
  touch: { fr: "Touchez pour commander", en: "Tap to order" },
  added: { fr: "Ajouté", en: "Added" },
  kitchen: { fr: "Écran de cuisine · Food Hub", en: "Kitchen screen · Food Hub" },
  status: [
    { fr: "Nouveau", en: "New" },
    { fr: "En préparation", en: "Preparing" },
    { fr: "Prêt", en: "Ready" },
  ],
  brand: { fr: "Votre marque", en: "Your brand" },
} as const;

function Source({ s }: { s: (typeof SOURCES)[number] }) {
  const b = s.icon ? BRAND_ICONS[s.icon] : null;
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white">
      {b ? (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill={b.hex}>
          <path d={b.path} />
        </svg>
      ) : s.Icon ? (
        <s.Icon size={13} className="text-[#0B1220]" aria-hidden />
      ) : (
        <span className="font-mono text-[9px] font-bold text-[#0B1220]">{s.name.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

/**
 * A restaurant at work: the kiosk menu rolls and takes a tap, the brand
 * colour changes, and orders from every channel land on the Food Hub kitchen
 * screen, then move from New to Ready. Static with reduced motion.
 */
export function KioskScene() {
  const { lang: l } = useLanguage();
  const lang = l as Lang;
  const reduced = useReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced || !seen) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1600);
    return () => window.clearInterval(t);
  }, [reduced, seen]);

  const brand = BRANDS[Math.floor(tick / 5) % BRANDS.length];
  const tapped = tick % 5;
  // The last four orders, newest first; each one ages through the statuses.
  const orders = [0, 1, 2, 3]
    .filter((k) => tick + 3 - k >= 0)
    .map((k) => {
      const n = tick + 3 - k;
      return { id: 100 + n, source: SOURCES[n % SOURCES.length], age: Math.min(2, k) };
    });

  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#0A1630,#060D1F)] p-4 sm:p-5">
      <span className="absolute right-3 top-3 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/60">{T.demo[lang]}</span>
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[170px_minmax(0,1fr)]">
        {/* The kiosk on its stand */}
        <div className="mx-auto flex w-[180px] flex-col items-center sm:w-auto">
          <div className="relative w-full overflow-hidden rounded-[18px] border-[5px] border-[#1B2436] bg-white shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]">
            <div className="flex items-center justify-between px-2.5 py-2 text-white transition-colors duration-700" style={{ background: brand }}>
              <span className="truncate text-[11px] font-bold">{T.kiosk[lang]}</span>
              <ChefHat size={13} aria-hidden />
            </div>
            <div className="relative h-[170px] overflow-hidden sm:h-[190px]">
              <ul className={`${reduced ? "" : "hp-kiosk-roll"} grid gap-1.5 p-2`}>
                {[...MENU, ...MENU].map((m, i) => (
                  <li
                    key={i}
                    className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-[10.5px] transition-all duration-300 ${
                      i % MENU.length === tapped ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    <span className="truncate font-semibold">{m[lang]}</span>
                    <span className="tabular-nums">{m.price} $</span>
                  </li>
                ))}
              </ul>
              <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg transition-colors duration-700" style={{ background: brand }}>
                <Hand size={11} className={reduced ? "" : "animate-bounce"} aria-hidden /> {T.touch[lang]}
              </span>
            </div>
          </div>
          <span className="h-6 w-3 bg-[#1B2436]" aria-hidden />
          <span className="h-2 w-16 rounded-full bg-[#1B2436]" aria-hidden />
          <div className="mt-2 flex items-center gap-1.5" aria-label={T.brand[lang]}>
            {BRANDS.map((c) => (
              <span key={c} className={`h-3 w-3 rounded-full ring-2 transition-all ${c === brand ? "scale-125 ring-white" : "ring-transparent"}`} style={{ background: c }} />
            ))}
          </div>
        </div>

        {/* Kitchen screen: orders from every channel */}
        <div className="flex min-w-0 flex-col rounded-[16px] border-[4px] border-[#1B2436] bg-[#0E1729] p-2.5">
          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white/80">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden /> {T.kitchen[lang]}
          </p>
          <ul className="mt-2 grid gap-1.5" aria-live="off">
            {orders.map((o, i) => (
              <li
                key={o.id}
                className={`flex items-center gap-2 rounded-lg bg-white/[0.06] px-2 py-1.5 ring-1 ring-white/10 ${i === 0 && !reduced ? "hp-ticket-in" : ""}`}
              >
                <Source s={o.source} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-semibold text-white">
                    {o.source.name} · #{o.id}
                  </span>
                  <span className="block truncate text-[10.5px] text-white/50">{MENU[o.id % MENU.length][lang]}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    o.age === 0 ? "bg-[#1E6BFF] text-white" : o.age === 1 ? "bg-amber-400/90 text-[#1B1300]" : "bg-emerald-500 text-white"
                  }`}
                >
                  {T.status[o.age][lang]}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-auto hidden flex-wrap gap-1.5 pt-2.5 sm:flex">
            {SOURCES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 rounded-full bg-white/[0.06] py-0.5 pl-0.5 pr-2 text-[10px] font-semibold text-white/70">
                <Source s={s} />
                {s.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
