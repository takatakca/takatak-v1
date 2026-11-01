"use client";

import {
  BarChart3,
  Bolt,
  ChefHat,
  GraduationCap,
  MapPin,
  Megaphone,
  MessagesSquare,
  Phone,
  Receipt,
  ScanSearch,
  Search,
  Share2,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";

import { BRAND_ICONS } from "@/lib/website/brand-icons";
import { WALL_AI, WALL_GROWTH, WALL_HOUSE, WALL_TOTAL, type WallItem } from "@/lib/website/connector-wall";
import { CORE_CATEGORIES } from "@/lib/website/core-categories";
import { TAKBOT_ENGINES } from "@/lib/takbot/catalog";
import { useLanguage } from "@/lib/website/use-language";
import { Rise, Ticker, useSeen } from "./primitives";

const HOUSE_ICONS: Record<string, LucideIcon> = {
  spark: Sparkles,
  share: Share2,
  chart: BarChart3,
  megaphone: Megaphone,
  star: Star,
  pin: MapPin,
  chat: MessagesSquare,
  scan: ScanSearch,
  bolt: Bolt,
  chef: ChefHat,
  search: Search,
  phone: Phone,
  cap: GraduationCap,
  receipt: Receipt,
};

/** Each house mark gets its own gradient, all inside the brand blues. */
const HOUSE_GRADIENTS = [
  "linear-gradient(135deg,#1E6BFF,#29C3FF)",
  "linear-gradient(160deg,#0B3BFF,#7A5CFF)",
  "linear-gradient(120deg,#00A3FF,#00E0FF)",
  "linear-gradient(200deg,#3C4BFF,#1E6BFF)",
  "linear-gradient(140deg,#5B3DF5,#29C3FF)",
  "linear-gradient(100deg,#0057FF,#5FA8FF)",
];

const T = {
  eyebrow: { fr: "Écosystème TAKATAK", en: "TAKATAK ecosystem" },
  live: { fr: "En direct de nos catalogues", en: "Live from our catalogs" },
  total: { fr: "connexions", en: "connections" },
  house: { fr: "conçues par TAKATAK", en: "built by TAKATAK" },
  lead: {
    fr: "Vos outils, vos réseaux, vos moteurs d'IA et nos propres applications, branchés dans un seul compte.",
    en: "Your tools, your networks, your AI engines and our own apps, plugged into one account.",
  },
  services: { fr: "services", en: "services" },
  engines: { fr: "moteurs d'IA dans TAK-TAK", en: "AI engines in TAK-TAK" },
  rows: { ai: { fr: "IA", en: "AI" }, growth: { fr: "Réseaux et outils", en: "Networks and tools" }, house: { fr: "Maison TAKATAK", en: "TAKATAK house" } },
  houseTag: { fr: "maison", en: "house" },
} as const;

function Mark({ item, index }: { item: WallItem; index: number }) {
  if (item.group === "house") {
    const Icon = item.mark ? HOUSE_ICONS[item.mark] : null;
    return (
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_20px_-8px_rgb(30_107_255/0.8)]"
        style={{ background: HOUSE_GRADIENTS[index % HOUSE_GRADIENTS.length] }}
      >
        {Icon ? <Icon size={17} strokeWidth={2.2} aria-hidden /> : <span className="font-mono text-[12px] font-bold tracking-tight">{item.mono}</span>}
      </span>
    );
  }
  const icon = item.icon ? BRAND_ICONS[item.icon] : null;
  if (icon) {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white">
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden fill={icon.hex}>
          <path d={icon.path} />
        </svg>
      </span>
    );
  }
  // No public mark: a clean monogram, never an imitation of the brand's logo.
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white/[0.08] font-mono text-[12px] font-bold text-white/80 ring-1 ring-white/15">
      {item.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase()}
    </span>
  );
}

function Row({ items, reverse, label, speed }: { items: WallItem[]; reverse?: boolean; label: string; speed: number }) {
  const { lang } = useLanguage();
  const doubled = [...items, ...items];
  return (
    <div className="hp-ticker min-w-0" role="group" aria-label={label}>
      <ul className="hp-ticker-track py-1" data-reverse={reverse || undefined} style={{ animationDuration: `${speed}s` }}>
        {doubled.map((item, i) => (
          <li
            key={`${item.key}-${i}`}
            aria-hidden={i >= items.length || undefined}
            className={`flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 ${
              item.group === "house" ? "bg-[#1E6BFF]/[0.14] ring-1 ring-[#29C3FF]/30" : "bg-white/[0.05] ring-1 ring-white/10"
            }`}
          >
            <Mark item={item} index={i % items.length} />
            <span className="whitespace-nowrap text-[14px] font-semibold text-white/90">{item.name}</span>
            {item.group === "house" && (
              <span className="rounded-full bg-[#29C3FF]/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#7FD8FF]">{T.houseTag[lang]}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Real logos of what TAKATAK connects to, our own marks next to them, and the true total. */
export function ConnectorWall() {
  const { lang } = useLanguage();
  const { ref, seen } = useSeen<HTMLDivElement>();
  return (
    <div ref={ref} className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-6 pt-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-center lg:gap-10">
      <Rise>
        <p className="hp-code-eyebrow flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7FD8FF]">
          <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          {T.eyebrow[lang]}
        </p>
        <p className="mt-1 pl-4 text-[12px] text-white/45">{T.live[lang]}</p>
        <p className="mt-3 flex items-baseline gap-3">
          <span className="hp-display text-[64px] leading-none text-white">
            <Ticker value={seen ? WALL_TOTAL : 0} format={(v) => String(Math.round(v))} />
          </span>
          <span className="text-[18px] font-semibold text-white">{T.total[lang]}</span>
        </p>
        <p className="mt-1 text-[14.5px] text-[#7FD8FF]">
          <Ticker value={seen ? WALL_HOUSE.length : 0} format={(v) => String(Math.round(v))} /> {T.house[lang]}
        </p>
        <p className="mt-4 max-w-sm text-[14.5px] leading-6 text-white/65">{T.lead[lang]}</p>
        <dl className="mt-5 flex gap-8">
          {[
            { n: CORE_CATEGORIES.length, l: T.services[lang] },
            { n: TAKBOT_ENGINES.length, l: T.engines[lang] },
          ].map((s) => (
            <div key={s.l}>
              <dt className="sr-only">{s.l}</dt>
              <dd className="flex items-baseline gap-2">
                <span className="hp-display text-[28px] leading-none text-white">
                  <Ticker value={seen ? s.n : 0} format={(v) => String(Math.round(v))} />
                </span>
                <span className="text-[13px] text-white/60">{s.l}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Rise>
      <div className="grid min-w-0 gap-3">
        <Row items={WALL_HOUSE} label={T.rows.house[lang]} speed={70} />
        <Row items={WALL_AI} reverse label={T.rows.ai[lang]} speed={60} />
        <Row items={WALL_GROWTH} label={T.rows.growth[lang]} speed={90} />
      </div>
    </div>
  );
}
