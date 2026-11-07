"use client";

import { useEffect, useState } from "react";
import { Bike, Check, ChefHat, CupSoda, Drumstick, Hand, MonitorSmartphone, Sandwich, ShoppingBag, Soup, Store, Utensils } from "lucide-react";

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

/** Kiosk tiles: the first four menu items, with an icon and a warm "photo" tone. */
const TILES = [
  { m: 0, Icon: Drumstick, bg: "linear-gradient(135deg,#FDBA74,#EA580C)" },
  { m: 2, Icon: Soup, bg: "linear-gradient(135deg,#FDE68A,#D97706)" },
  { m: 4, Icon: Sandwich, bg: "linear-gradient(135deg,#FCA5A5,#DC2626)" },
  { m: 5, Icon: CupSoda, bg: "linear-gradient(135deg,#BEF264,#65A30D)" },
] as const;

const CATS = [
  { fr: "Populaires", en: "Popular" },
  { fr: "Poulet", en: "Chicken" },
  { fr: "À côté", en: "Sides" },
  { fr: "Boissons", en: "Drinks" },
];

/** How each order leaves: take-out, delivery or dine-in. */
const MODES = [
  { key: "pickup", Icon: ShoppingBag, fr: "Pour emporter", en: "Take-out" },
  { key: "delivery", Icon: Bike, fr: "Livraison", en: "Delivery" },
  { key: "dinein", Icon: Utensils, fr: "Sur place", en: "Dine-in" },
] as const;

const price = (m: number) => Number(MENU[m].price.replace(",", "."));
const fmt = (n: number, lang: Lang) => (lang === "fr" ? `${n.toFixed(2).replace(".", ",")} $` : `$${n.toFixed(2)}`);

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
  order: { fr: "Commander", en: "Order" },
  cart: { fr: "Panier", en: "Cart" },
  thanks: { fr: "Merci !", en: "Thank you!" },
  ready: { fr: "Prêt dans 12 min", en: "Ready in 12 min" },
  sent: { fr: "Envoyée en cuisine", en: "Sent to the kitchen" },
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
  // The kiosk loop: browse, tap one item, tap a drink, press Order, thank-you screen.
  const stage = reduced ? 4 : tick % 5;
  const cartCount = stage >= 2 ? 2 : stage >= 1 ? 1 : 0;
  const cartTotal = (stage >= 1 ? price(TILES[0].m) : 0) + (stage >= 2 ? price(TILES[3].m) : 0);
  // The last four orders, newest first; each one ages through the statuses.
  const orders = [0, 1, 2, 3]
    .filter((k) => tick + 3 - k >= 0)
    .map((k) => {
      const n = tick + 3 - k;
      return { id: 100 + n, source: SOURCES[n % SOURCES.length], age: Math.min(2, k) };
    });

  return (
    <div ref={ref} className="relative flex h-full items-center overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#0A1630,#060D1F)] p-4 pt-11 sm:p-6">
      <span className="absolute right-3 top-3 z-[3] rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/60">{T.demo[lang]}</span>
      <div className="grid w-full grid-cols-1 items-center gap-4 sm:grid-cols-[190px_minmax(0,1fr)] [&>*]:min-w-0">
        {/* The kiosk on its stand */}
        <div className="mx-auto flex w-[200px] flex-col items-center sm:mx-0 sm:w-full">
          <div className="relative w-full overflow-hidden rounded-[18px] border-[5px] border-[#1B2436] bg-white shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]">
            <div className="flex items-center justify-between px-2.5 py-2 text-white transition-colors duration-700" style={{ background: brand }}>
              <span className="truncate text-[11px] font-bold">{T.kiosk[lang]}</span>
              <ChefHat size={13} aria-hidden />
            </div>
            <div className="relative h-[200px] overflow-hidden sm:h-[214px]">
              {/* Categories */}
              <div className="flex gap-1 overflow-hidden px-2 pt-2">
                {CATS.map((c, i) => (
                  <span key={c.en} className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold transition-colors ${i === 0 ? "text-white" : "bg-slate-100 text-slate-600"}`} style={i === 0 ? { background: brand } : undefined}>
                    {c[lang]}
                  </span>
                ))}
              </div>
              {/* Item tiles: two taps add to the cart */}
              <div className="grid grid-cols-2 gap-1.5 p-2">
                {TILES.map((t, i) => {
                  const hit = (stage === 1 && i === 0) || (stage === 2 && i === 3);
                  return (
                    <div
                      key={t.m}
                      className={`relative overflow-hidden rounded-lg bg-slate-50 ring-1 transition-all duration-300 ${hit ? "scale-95 ring-2" : "ring-slate-200"}`}
                      style={hit ? { boxShadow: `0 0 0 2px ${brand}` } : undefined}
                    >
                      <span className="grid h-9 place-items-center text-white" style={{ background: t.bg }}>
                        <t.Icon size={16} aria-hidden />
                      </span>
                      <span className="block truncate px-1.5 pt-1 text-[9.5px] font-semibold text-slate-800">{MENU[t.m][lang]}</span>
                      <span className="block px-1.5 pb-1 text-[9px] tabular-nums text-slate-500">{MENU[t.m].price} $</span>
                      {hit && (
                        <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: brand }}>
                          +1
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Cart bar */}
              <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-2 py-1.5 text-white">
                <span className="flex min-w-0 items-center gap-1 whitespace-nowrap text-[9px]">
                  <ShoppingBag size={10} className="shrink-0" aria-hidden /> {cartCount}
                  <span className="tabular-nums text-white/70">{cartCount > 0 ? fmt(cartTotal, lang) : T.cart[lang]}</span>
                </span>
                <span className={`rounded-md px-2 py-0.5 text-[9.5px] font-bold transition-transform ${stage === 3 ? "scale-90" : ""}`} style={{ background: brand }}>
                  {T.order[lang]}
                </span>
              </div>
              {stage === 0 && (
                <span className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-slate-800 shadow-lg">
                  <Hand size={11} className={reduced ? "" : "animate-bounce"} aria-hidden /> {T.touch[lang]}
                </span>
              )}
              {/* Confirmation */}
              <div className={`absolute inset-0 grid place-items-center bg-white text-center transition-opacity duration-500 ${stage === 4 ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                <div>
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-full text-white" style={{ background: brand }}>
                    <Check size={22} strokeWidth={3} aria-hidden />
                  </span>
                  <p className="mt-2 text-[14px] font-extrabold text-slate-900">{T.thanks[lang]}</p>
                  <p className="text-[11px] font-semibold text-slate-600">#{100 + tick} · {T.ready[lang]}</p>
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700">
                    <ChefHat size={10} aria-hidden /> {T.sent[lang]}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <span className="h-6 w-3 bg-[#1B2436]" aria-hidden />
          <span className="h-2 w-16 rounded-full bg-[#1B2436]" aria-hidden />
          <div className="mt-2 flex items-center gap-1.5" role="img" aria-label={T.brand[lang]}>
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
          <div className="mt-2 flex flex-wrap gap-1">
            {MODES.map((m, i) => (
              <span key={m.key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${i === 0 ? "bg-white text-[#0B1220]" : "bg-white/[0.06] text-white/60"}`}>
                <m.Icon size={10} aria-hidden /> {m[lang]}
              </span>
            ))}
          </div>
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
                  <span className="flex items-center gap-1 truncate text-[10.5px] text-white/50">
                    {(() => {
                      const m = MODES[o.id % MODES.length];
                      return <m.Icon size={10} className="shrink-0" aria-hidden />;
                    })()}
                    {MENU[o.id % MENU.length][lang]} · {[12, 8, 15, 10][o.id % 4]} min
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    o.age === 0 ? "bg-[#1E6BFF] text-white" : o.age === 1 ? "bg-amber-400/90 text-[#1B1300]" : "bg-emerald-700 text-white"
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
