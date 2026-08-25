"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/website/nav";
import {
  TrendingUp, Palette, Code2, Megaphone, PenLine, Video,
  Briefcase, Bot, MapPin, Database, ChevronLeft, ChevronRight, ArrowRight,
} from "lucide-react";
import { MARKETPLACE_GROUPS, groupPackages, type MarketplaceGroup } from "@/lib/website/marketplace-groups";
import { formatStartingPrice } from "@/lib/website/marketplace-packages";
import { ServiceThumbnail } from "@/components/website/marketplace/ServiceThumbnail";
import { useLanguage } from "@/lib/website/use-language";

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
 * Premium marketplace category rail. Horizontally scrollable with edge
 * fades, arrow controls and a desktop hover/focus preview panel showing
 * up to four real packages with starting prices.
 */
export function MarketplaceCategoryRail({ compact = false }: { compact?: boolean }) {
  const { tx } = useLanguage();
  const scrollerRef = useRef<HTMLUListElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

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
      aria-label="Marketplace categories"
      className="relative border-b border-border bg-background/95 backdrop-blur"
      onKeyDown={(e) => { if (e.key === "Escape") setPreview(null); }}
    >
      <div className="relative mx-auto max-w-7xl px-4">
        {!atStart && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Scroll categories left"
            className="absolute left-1 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-border bg-background p-1.5 shadow-sm hover:bg-secondary md:inline-flex"
          >
            <ChevronLeft size={15} />
          </button>
        )}
        {!atEnd && (
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Scroll categories right"
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
          className={`flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${compact ? "py-1.5" : "py-2"} md:px-7`}
        >
          {MARKETPLACE_GROUPS.map((g) => {
            const Icon = ICONS[g.slug] ?? Palette;
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
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 ${compact ? "py-1.5 text-[13px]" : "py-2 text-sm"} font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                  activeProps={{ className: "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-secondary" }}
                >
                  <Icon size={15} className="text-primary" aria-hidden />
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
          <div className="mx-auto max-w-7xl px-4">
            <CategoryPreview group={active} />
          </div>
        </div>
      )}
    </nav>
  );
}

function CategoryPreview({ group }: { group: MarketplaceGroup }) {
  const { tx } = useLanguage();
  const packages = groupPackages(group.slug).slice(0, 4);
  if (packages.length === 0) return null;

  return (
    <div className="animate-fade-in rounded-b-xl border border-t-0 border-border bg-popover p-4 shadow-xl">
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <div className="hidden overflow-hidden rounded-lg border border-border md:block">
          <ServiceThumbnail kind={packages[0].thumb} />
          <p className="p-2.5 text-xs text-muted-foreground">{tx(group.blurb)}</p>
        </div>
        <div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {packages.map((p) => (
              <Link
                key={p.id}
                to="/marketplace/gigs/$id"
                params={{ id: p.slug }}
                className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-secondary"
              >
                <span className="truncate text-foreground/85">{p.title}</span>
                <span className="shrink-0 text-xs font-semibold text-primary">
                  {tx({ en: "from", fr: "dès" })} {formatStartingPrice(p)}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/marketplace/search"
              search={{ q: "", category: "", sort: "recommended", group: group.slug }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              {tx({ en: "Explore category", fr: "Explorer la catégorie" })} <ArrowRight size={13} />
            </Link>
            <Link
              to="/marketplace/post-project"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
            >
              {tx({ en: "Start a project", fr: "Démarrer un projet" })}
            </Link>
            <Link
              to={group.serviceTo}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {tx({ en: "TAKATAK service page", fr: "Page de service TAKATAK" })}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
