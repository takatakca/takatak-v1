"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, Check, MapPin, Phone, Search } from "lucide-react";

import { openLiveChat } from "@/lib/website/chat-provider";
import { SUITE_GROUPS, homeCopy, homeV2, type SuiteProduct, type SuiteStatus } from "@/lib/website/home-funnel";
import { externalLinkProps } from "@/lib/website/product-destinations";
import { useLanguage } from "@/lib/website/use-language";
import { sectionId } from "./HomeSectionNav";
import { Eyebrow, Rise, Section, TwoTone } from "./primitives";

const ALL = SUITE_GROUPS.flatMap((g) => g.products);
const product = (key: string) => ALL.find((p) => p.key === key) as SuiteProduct;
const CLOVER_APPS = ALL.filter((p) => p.status === "clover" || p.key === "ch4t");

const DOT: Record<SuiteStatus, string> = {
  live: "bg-emerald-400",
  early: "bg-sky-300",
  clover: "bg-slate-400",
  soon: "bg-amber-300",
  planned: "bg-amber-300",
};

function Status({ status }: { status: SuiteStatus }) {
  const { lang } = useLanguage();
  return (
    <span className="inline-flex items-center gap-1.5 hp-ink-2 text-[12.5px]">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      {homeCopy.suite.status[status][lang]}
    </span>
  );
}

function Tile({
  p,
  title,
  className = "",
  visual,
  children,
}: {
  p?: SuiteProduct;
  title?: string;
  className?: string;
  visual?: ReactNode;
  children?: ReactNode;
}) {
  const { lang } = useLanguage();
  const body = (
    <>
      <div className="relative z-[2] flex items-start justify-between gap-3">
        <div>
          <p className="hp-display hp-ink text-[24px]">{title ?? p?.name}</p>
          {p && <p className="mt-1 max-w-sm text-[14px] leading-6 hp-ink-2">{p.desc[lang]}</p>}
        </div>
        {p?.url && <ArrowUpRight size={20} className="hp-ink-3 shrink-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--hp-ink)]" aria-hidden />}
      </div>
      {visual && <div className="relative z-[2] mt-6 flex-1">{visual}</div>}
      {children}
      {p && (
        <div className="relative z-[2] mt-5">
          <Status status={p.status} />
        </div>
      )}
    </>
  );
  const cls = `group hp-card relative flex flex-col overflow-hidden rounded-[28px] p-6 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[var(--hp-shadow)] sm:p-7 ${className}`;
  return p?.url ? (
    <a href={p.url} {...externalLinkProps} className={cls}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function KitchenScreen() {
  const orders = [
    { id: "A-214", src: "Uber Eats", items: "2 × Poutine classique · 1 × Limonade", t: "12 min", tone: "bg-[#06C167]" },
    { id: "D-088", src: "DoorDash", items: "1 × Burger maison · 1 × Frites", t: "9 min", tone: "bg-[#FF3008]" },
    { id: "C-731", src: "Clover", items: "3 × Café latte · 2 × Croissant", t: "4 min", tone: "bg-white" },
  ];
  return (
    <div className="h-full rounded-2xl border border-white/10 bg-[#050B1A] p-3">
      <div className="flex items-center justify-between px-1 pb-2 text-[11px] text-white/45">
        <span className="font-semibold uppercase tracking-[0.16em]">Cuisine · Kitchen</span>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]">Illustration</span>
      </div>
      <ul className="grid gap-2">
        {orders.map((o, i) => (
          <li key={o.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${i === 0 ? "bg-[#1F8BFF]/15 ring-1 ring-[#1F8BFF]/50" : "bg-white/[0.04]"}`}>
            <span className={`h-8 w-1 rounded-full ${o.tone}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-white">
                {o.id} <span className="font-normal text-white/45">{o.src}</span>
              </span>
              <span className="block truncate text-[11.5px] text-white/55">{o.items}</span>
            </span>
            <span className="text-[11px] tabular-nums text-white/45">{o.t}</span>
            {i === 0 ? (
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#060D1F]">Accepter</span>
            ) : (
              <Check size={14} className="text-emerald-300" aria-hidden />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MapVisual() {
  return (
    <div className="relative h-36 overflow-hidden rounded-2xl border border-white/10 bg-[#0A1530]">
      <svg viewBox="0 0 300 140" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d="M0 95 C60 80 90 110 150 92 S250 60 300 75" stroke="#1F8BFF" strokeOpacity="0.35" strokeWidth="10" fill="none" />
        <path d="M70 0 L95 140 M200 0 L180 140 M0 40 L300 30" stroke="white" strokeOpacity="0.07" strokeWidth="2" />
      </svg>
      {[
        [28, 38],
        [56, 62],
        [74, 30],
      ].map(([l, t], i) => (
        <span key={i} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${l}%`, top: `${t + 20}%` }}>
          <MapPin size={i === 1 ? 26 : 18} className={i === 1 ? "fill-[#29C3FF] text-[#060D1F]" : "fill-white/70 text-[#060D1F]"} aria-hidden />
        </span>
      ))}
      <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] text-[#060D1F]">
        <Search size={11} aria-hidden /> boulangerie · Laval
      </span>
    </div>
  );
}

function PipelineVisual() {
  const cols = [
    { k: "Nouveaux", n: 12, w: "100%" },
    { k: "Contactés", n: 7, w: "62%" },
    { k: "Gagnés", n: 3, w: "28%" },
  ];
  return (
    <div className="grid gap-2.5">
      {cols.map((c) => (
        <div key={c.k} className="grid grid-cols-[76px_1fr_24px] items-center gap-3 text-[12px]">
          <span className="hp-ink-2">{c.k}</span>
          <span className="h-2 overflow-hidden rounded-full bg-[var(--hp-line)]">
            <span className="block h-full rounded-full bg-[linear-gradient(90deg,#1F8BFF,#29C3FF)]" style={{ width: c.w }} />
          </span>
          <span className="text-right tabular-nums hp-ink">{c.n}</span>
        </div>
      ))}
    </div>
  );
}

/** TAKATAK's own products as a bento grid, each with its real status. */
export function SuiteBento() {
  const { lang } = useLanguage();
  return (
    <Section id={sectionId("suite")} labelledBy="home-suite-title" className="hp-bg py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <Rise className="max-w-3xl">
          <Eyebrow>{homeV2.suite.eyebrow[lang]}</Eyebrow>
          <TwoTone id="home-suite-title" lead={homeV2.suite.lead[lang]} rest={homeV2.suite.rest[lang]} />
        </Rise>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <Rise className="md:col-span-2 lg:row-span-2">
            <Tile p={product("foodhub")} title="TAKATAK Food Hub" className="h-full min-h-[460px]" visual={<KitchenScreen />}>
              <button
                type="button"
                onClick={() => openLiveChat({ page: "/", intent: "suite_foodhub", lang })}
                className="relative z-[2] mt-5 w-fit hp-cta rounded-full px-5 py-2.5 text-[13.5px] font-semibold"
              >
                {homeCopy.suite.ask[lang]}
              </button>
            </Tile>
          </Rise>

          <Rise delay={80} className="md:col-span-2">
            <Tile title={lang === "fr" ? "La suite Clover" : "The Clover suite"} className="h-full">
              <p className="relative z-[2] mt-1 text-[14px] hp-ink-2">
                {lang === "fr" ? "Neuf applications pour votre caisse Clover." : "Nine apps for your Clover point of sale."}
              </p>
              <ul className="relative z-[2] mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {CLOVER_APPS.map((a) => (
                  <li key={a.key}>
                    <span className="block text-[13.5px] font-bold tracking-[0.06em] hp-ink">{a.name}</span>
                    <span className="block truncate text-[12px] hp-ink-3">{a.desc[lang]}</span>
                  </li>
                ))}
              </ul>
              <div className="relative z-[2] mt-5">
                <Status status="clover" />
              </div>
            </Tile>
          </Rise>

          <Rise delay={140}>
            <Tile p={product("qmaps")} className="h-full" visual={<MapVisual />} />
          </Rise>
          <Rise delay={200}>
            <Tile p={product("flexs")} className="h-full" visual={<PipelineVisual />} />
          </Rise>

          <Rise delay={80}>
            <Tile
              p={product("mimt")}
              className="h-full"
              visual={
                <div className="flex items-center gap-3 rounded-2xl hp-raised p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                    <Phone size={17} className="animate-pulse" aria-hidden />
                  </span>
                  <span className="text-[13px] tabular-nums hp-ink">+1 514 · · · · · · ·</span>
                </div>
              }
            />
          </Rise>
          <Rise delay={140}>
            <Tile
              p={product("academy")}
              className="h-full"
              visual={
                <div className="grid gap-2">
                  {[86, 54, 22].map((w, i) => (
                    <span key={w} className="h-1.5 overflow-hidden rounded-full bg-[var(--hp-line)]">
                      <span className="block h-full rounded-full bg-[var(--hp-cta)]" style={{ width: `${w}%`, opacity: 1 - i * 0.25 }} />
                    </span>
                  ))}
                </div>
              }
            />
          </Rise>
          <Rise delay={200} className="md:col-span-2">
            <Tile
              p={product("seo")}
              className="h-full"
              visual={
                <svg viewBox="0 0 400 80" className="h-20 w-full" aria-hidden>
                  <defs>
                    <linearGradient id="seo-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#29C3FF" stopOpacity="0.35" />
                      <stop offset="1" stopColor="#29C3FF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 70 L40 64 L80 66 L120 52 L160 55 L200 40 L240 42 L280 28 L320 30 L360 16 L400 10 L400 80 L0 80 Z" fill="url(#seo-fill)" />
                  <path d="M0 70 L40 64 L80 66 L120 52 L160 55 L200 40 L240 42 L280 28 L320 30 L360 16 L400 10" stroke="#29C3FF" strokeWidth="2" fill="none" />
                </svg>
              }
            />
          </Rise>
        </div>
      </div>
    </Section>
  );
}
