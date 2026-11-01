"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { ArrowUpRight, Play } from "lucide-react";

import { money } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { MIMT_PLAN_LIST } from "@/lib/website/mimt-plans";
import { SUITE_GROUPS, homeCopy, homeV2, type SuiteProduct, type SuiteStatus } from "@/lib/website/home-funnel";
import { externalLinkProps } from "@/lib/website/product-destinations";
import { useLanguage } from "@/lib/website/use-language";
import { sectionId } from "./HomeSectionNav";
import { CloverSuite } from "./CloverSuite";
import { KioskScene } from "./KioskScene";
import { ClipModal } from "./MediaLoop";
import { FlexsScene, MimtTeaser, QmapsScene } from "./SuiteScenes";
import { Eyebrow, Rise, Section, TwoTone } from "./primitives";

const ALL = SUITE_GROUPS.flatMap((g) => g.products);
const product = (key: string) => ALL.find((p) => p.key === key) as SuiteProduct;

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
    <span className="inline-flex items-center gap-1.5 hp-ink-2 text-[13.5px]">
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
  const cls = `group hp-card hp-glow relative flex flex-col overflow-hidden rounded-[28px] p-6 transition-[box-shadow] duration-500 hover:shadow-[var(--hp-shadow)] sm:p-7 ${className}`;
  return p?.url ? (
    <a href={p.url} {...externalLinkProps} className={cls}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * A real screenshot of the TAKATAK app in a slim browser frame. On hover the
 * picture scrolls slowly so more of the real page shows.
 */
function Shot({ src, url, alt, className = "h-[220px]" }: { src: string; url: string; alt: string; className?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--hp-line)] shadow-[0_24px_50px_-30px_rgb(6_13_31/0.45)]">
      <div className="flex items-center gap-2 border-b border-black/5 bg-[#F6F7F9] px-3 py-2">
        <span className="flex gap-1" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-black/10" />
          <span className="h-2 w-2 rounded-full bg-black/10" />
          <span className="h-2 w-2 rounded-full bg-black/10" />
        </span>
        <span className="truncate text-[11px] text-black/45">{url}</span>
      </div>
      <div className={`hp-materialize relative overflow-hidden ${className}`}>
        <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 640px, 100vw" className="hp-shot object-cover object-top" />
      </div>
    </div>
  );
}

/** TAKATAK's own products as a bento grid, each with its real status. */
export function SuiteBento() {
  const { lang } = useLanguage();
  const [clip, setClip] = useState(false);
  return (
    <Section id={sectionId("suite")} labelledBy="home-suite-title" className="hp-bg py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <Rise className="max-w-3xl">
          <Eyebrow>{homeV2.suite.eyebrow[lang]}</Eyebrow>
          <TwoTone id="home-suite-title" lead={homeV2.suite.lead[lang]} rest={homeV2.suite.rest[lang]} />
        </Rise>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <Rise className="hp-build md:col-span-2 lg:row-span-2">
            <Tile
              p={product("foodhub")}
              title="TAKATAK Food Hub"
              className="h-full min-h-[460px]"
              visual={<KioskScene />}
            >
              <div className="relative z-[2] mt-5">
                <p className="hp-display hp-ink text-[20px] leading-tight">
                  {lang === "fr" ? "Une tablette. Toutes vos commandes." : "One tablet. Every order."}
                </p>
                <ul className="mt-3 grid gap-2 text-[14px] leading-6 hp-ink-2 sm:grid-cols-3 sm:gap-4">
                  {(lang === "fr"
                    ? [
                        ["Livraison", "Vos plateformes de livraison arrivent sur un seul écran, au lieu d’une pile de tablettes."],
                        ["Borne et comptoir", "La borne T4CTILE et la caisse Clover envoient au même écran de cuisine."],
                        ["À votre nom", "Vos propres commandes en ligne et livraisons suivies par TR4CKER (en préparation)."],
                      ]
                    : [
                        ["Delivery", "Your delivery platforms land on one screen, not a stack of tablets."],
                        ["Kiosk and counter", "The T4CTILE kiosk and the Clover register send to the same kitchen screen."],
                        ["Under your name", "Your own online orders and deliveries tracked by TR4CKER (in preparation)."],
                      ]
                  ).map(([t, d]) => (
                    <li key={t}>
                      <span className="block font-semibold hp-ink">{t}</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => openLiveChat({ page: "/", intent: "suite_foodhub", lang })}
                className="relative z-[2] mt-5 w-fit hp-cta rounded-full px-5 py-2.5 text-[13.5px] font-semibold"
              >
                {homeCopy.suite.ask[lang]}
              </button>
            </Tile>
          </Rise>

          <Rise delay={140} className="hp-build">
            <Tile p={product("qmaps")} className="h-full" visual={<QmapsScene />} />
          </Rise>
          <Rise delay={200} className="hp-build">
            <Tile p={product("flexs")} className="h-full" visual={<FlexsScene />} />
          </Rise>

          <Rise delay={80} className="hp-build">
            <Tile
              p={product("mimt")}
              className="h-full"
              visual={<MimtTeaser fromLabel={`${lang === "fr" ? "Dès" : "From"} ${money(lang, MIMT_PLAN_LIST.free.monthlyCents / 100)}`} />}
            />
          </Rise>
          <Rise delay={140} className="hp-build">
            <Tile
              p={product("academy")}
              className="h-full"
              visual={<Shot src="/media/product/shot-academy.webp" url="TAKATAK Academy" alt={lang === "fr" ? "La page d’accueil de TAKATAK Academy" : "The TAKATAK Academy home page"} className="h-[180px]" />}
            />
          </Rise>
          <Rise className="hp-build md:col-span-2 lg:col-span-4">
            <Tile title={lang === "fr" ? "La suite Clover" : "The Clover suite"} className="h-full">
              <p className="relative z-[2] mt-1 max-w-3xl text-[14px] hp-ink-2">
                {lang === "fr"
                  ? "Neuf applications pour votre caisse Clover. Chacune fonctionne seule ; ensemble, elles se parlent par Food Hub et se gèrent avec l’IA de TAKATAK."
                  : "Nine apps for your Clover point of sale. Each works on its own; together they talk through Food Hub and are managed with TAKATAK's AI."}
              </p>
              <button
                type="button"
                onClick={() => setClip(true)}
                className="relative z-[2] mt-4 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold hp-ghost hover:bg-[var(--hp-line)]"
              >
                <Play size={14} className="fill-current" aria-hidden />
                {lang === "fr" ? "Voir la vidéo · 14 s" : "Watch the video · 14 s"}
              </button>
              <CloverSuite statusLabel={<Status status="clover" />} />
            </Tile>
          </Rise>
          <Rise className="hp-build md:col-span-2 lg:col-span-4">
            <Tile p={product("seo")} className="h-full">
              <div className="relative z-[2] mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div>
                  <ul className="grid gap-2.5 text-[14.5px] leading-6 hp-ink-2">
                    {(lang === "fr"
                      ? [
                          "Audit de site et Core Web Vitals, en ligne aujourd’hui",
                          "15 outils gratuits : robots.txt, sitemap, schéma, llms.txt, aperçu Google…",
                          "Vos vraies requêtes Search Console, classées avec leur raison",
                          "Préparation aux réponses d’IA (GEO), aucun lien acheté",
                        ]
                      : [
                          "Site audit and Core Web Vitals, live today",
                          "15 free tools: robots.txt, sitemap, schema, llms.txt, Google preview…",
                          "Your real Search Console queries, ranked with their reason",
                          "Ready for AI answers (GEO), no bought links",
                        ]
                    ).map((l) => (
                      <li key={l} className="flex gap-2.5">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--hp-info)]" aria-hidden />
                        {l}
                      </li>
                    ))}
                  </ul>
                  <a href="/seo" className="mt-5 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-semibold hp-cta">
                    {lang === "fr" ? "Tout sur SEO TAKATAK" : "All about SEO TAKATAK"} <ArrowUpRight size={15} aria-hidden />
                  </a>
                </div>
                <Shot src="/media/product/shot-seo.webp" url="takatak.ca/dashboard/seo" alt={lang === "fr" ? "L’audit SEO du tableau de bord TAKATAK" : "The SEO audit in the TAKATAK dashboard"} className="h-[260px]" />
              </div>
            </Tile>
          </Rise>
        </div>
      </div>
      {clip && <ClipModal clip="clover-suite" lang={lang} onClose={() => setClip(false)} />}
    </Section>
  );
}
