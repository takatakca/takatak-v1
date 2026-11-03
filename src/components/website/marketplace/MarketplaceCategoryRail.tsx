"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/website/nav";
import {
  TrendingUp, Palette, Code2, Megaphone, PenLine, Video,
  Briefcase, Bot, MapPin, Database, ChevronLeft, ChevronRight, ArrowRight, Clock3, Flame,
} from "lucide-react";
import { MARKETPLACE_GROUPS, groupPackages, type MarketplaceGroup } from "@/lib/website/marketplace-groups";
import { fastestDelivery, packageTitle, startingPrice } from "@/lib/website/marketplace-i18n";
import { ServiceThumbnail } from "@/components/website/marketplace/ServiceThumbnail";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";

const ICONS: Record<string, typeof Palette> = {
  trending: TrendingUp,
  "graphics-design": Palette,
  "programming-tech": Code2,
  "digital-marketing": Megaphone,
  "writing-translation": PenLine,
  "video-animation": Video,
  business: Briefcase,
  "ai-services": Bot,
  "local-visibility": MapPin,
  "data-admin": Database,
};

/**
 * Premium marketplace category rail. Each category is a glass pill; a light
 * travels from one pill to the next (its border spins), icons turn on hover,
 * a beam runs under the bar, and "Trending" keeps its spinning border.
 * Horizontally scrollable with edge fades and arrows; the desktop hover/focus
 * panel shows six real packages with French names and prices on French pages.
 */
export function MarketplaceCategoryRail({ compact = false }: { compact?: boolean }) {
  const { tx } = useLanguage();
  const reduced = useReducedMotion();
  const scrollerRef = useRef<HTMLUListElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [hot, setHot] = useState(1);
  const [paused, setPaused] = useState(false);

  // The travelling light: one pill at a time, paused while the visitor is on the rail.
  useEffect(() => {
    if (reduced || paused) return;
    const id = window.setInterval(() => setHot((i) => (i % (MARKETPLACE_GROUPS.length - 1)) + 1), 2600);
    return () => window.clearInterval(id);
  }, [reduced, paused]);

  function sync() {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }

  useEffect(() => {
    sync();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function nudge(dir: -1 | 1) {
    scrollerRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }

  function openPreview(slug: string) {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setPreview(slug);
  }
  function schedulePreviewClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPreview(null), 160);
  }

  const active = preview ? MARKETPLACE_GROUPS.find((g) => g.slug === preview) : null;

  return (
    <nav
      aria-label={tx({ en: "Marketplace categories", fr: "Catégories du marché" })}
      className="relative overflow-visible"
      onKeyDown={(e) => { if (e.key === "Escape") setPreview(null); }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 border-b border-border bg-background/95 backdrop-blur"
      />
      <div aria-hidden className="tk-rail-beam pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden" />
      <div className="relative mx-auto max-w-7xl px-4">
        {!atStart && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label={tx({ en: "Scroll categories left", fr: "Catégories précédentes" })}
            className="absolute left-1 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-border bg-background p-1.5 shadow-sm hover:bg-secondary md:inline-flex"
          >
            <ChevronLeft size={15} />
          </button>
        )}
        {!atEnd && (
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label={tx({ en: "Scroll categories right", fr: "Catégories suivantes" })}
            className="absolute right-1 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-border bg-background p-1.5 shadow-sm hover:bg-secondary md:inline-flex"
          >
            <ChevronRight size={15} />
          </button>
        )}
        {!atStart && (
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r from-background to-transparent" aria-hidden />
        )}
        {!atEnd && (
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-background to-transparent" aria-hidden />
        )}

        <ul
          ref={scrollerRef}
          className={`flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${compact ? "py-1.5" : "py-2.5"} md:px-7`}
        >
          {MARKETPLACE_GROUPS.map((g, i) => {
            const Icon = ICONS[g.slug] ?? Palette;
            const trending = g.slug === "trending";
            const lit = trending || (!reduced && i === hot && !paused) || preview === g.slug;
            return (
              <li
                key={g.slug}
                className="shrink-0"
                onMouseEnter={() => openPreview(g.slug)}
                onMouseLeave={schedulePreviewClose}
              >
                <Link
                  to="/marketplace/search"
                  search={{ q: "", category: "", sort: "recommended", group: g.slug }}
                  onFocus={() => openPreview(g.slug)}
                  onBlur={schedulePreviewClose}
                  data-lit={lit ? "" : undefined}
                  data-trending={trending ? "" : undefined}
                  className={`tk-rail-pill group inline-flex items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-3.5 ${compact ? "text-[13px]" : "text-sm"} font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[lit]:text-foreground`}
                >
                  <span className="tk-rail-icon grid h-7 w-7 place-items-center rounded-full">
                    {trending ? <Flame size={14} aria-hidden /> : <Icon size={14} aria-hidden />}
                  </span>
                  {tx(g.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {active && (
        <div
          className="absolute left-0 right-0 top-full z-40 hidden md:block"
          onMouseEnter={() => openPreview(active.slug)}
          onMouseLeave={schedulePreviewClose}
        >
          <div className="mx-auto max-w-5xl px-4">
            <CategoryPreview group={active} />
          </div>
        </div>
      )}
    </nav>
  );
}

function CategoryPreview({ group }: { group: MarketplaceGroup }) {
  const { tx, lang } = useLanguage();
  const packages = groupPackages(group.slug).slice(0, 6);
  if (packages.length === 0) return null;
  const Icon = ICONS[group.slug] ?? Palette;

  return (
    <div className="tk-rail-panel mt-2 overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-[0_30px_80px_-30px_rgb(6_13_31/0.7)] backdrop-blur-xl">
      <div aria-hidden className="h-[2px] bg-[linear-gradient(90deg,transparent,#1F8BFF,#29C3FF,transparent)]" />
      <div className="grid gap-5 p-5 md:grid-cols-[230px_1fr]">
        <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
          <ServiceThumbnail kind={packages[0].thumb} />
          <div className="p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="tk-rail-icon grid h-6 w-6 place-items-center rounded-full" data-static="">
                <Icon size={12} aria-hidden />
              </span>
              {tx(group.label)}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{tx(group.blurb)}</p>
            <Link
              to={group.serviceTo}
              className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {tx({ en: "TAKATAK service page", fr: "Page de service TAKATAK" })} <ArrowRight size={12} aria-hidden />
            </Link>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tx({ en: "Popular packages", fr: "Forfaits populaires" })}
          </p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {packages.map((p, i) => (
              <Link
                key={p.id}
                to="/marketplace/gigs/$id"
                params={{ id: p.slug }}
                className="tk-rail-item group/item flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 transition-[transform,border-color,background-color] duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{packageTitle(p, lang)}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock3 size={11} aria-hidden /> {fastestDelivery(p, lang)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors group-hover/item:bg-primary group-hover/item:text-primary-foreground">
                  {startingPrice(p, lang)}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/marketplace/search"
              search={{ q: "", category: "", sort: "recommended", group: group.slug }}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_rgb(31_139_255/0.8)] hover:opacity-90"
            >
              {tx({ en: "Explore category", fr: "Explorer la catégorie" })} <ArrowRight size={13} aria-hidden />
            </Link>
            <Link
              to="/marketplace/post-project"
              className="rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary"
            >
              {tx({ en: "Start a project", fr: "Démarrer un projet" })}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
