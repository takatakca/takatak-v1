"use client";

import { useState } from "react";
import { useNavigate } from "@/lib/website/nav";
import { Search, ShieldCheck, Star, Clock } from "lucide-react";
import { ServiceThumbnail } from "./ServiceThumbnail";

const QUICK_PICKS = [
  "Logo design",
  "Website",
  "Social media",
  "Shopify store",
  "Local SEO",
  "Menu design",
];

const HERO_COLLAGE = [
  { thumb: "website" as const, title: "Business website build", price: "$180", rating: "4.9", delivery: "5 days",
    pos: "top-0 left-0 w-[62%] rotate-[-3deg] z-20" },
  { thumb: "logo" as const, title: "Brand logo design", price: "$25", rating: "5.0", delivery: "2 days",
    pos: "top-[8%] right-0 w-[42%] rotate-[4deg] z-10" },
  { thumb: "seo" as const, title: "Local SEO dashboard", price: "$99", rating: "4.8", delivery: "5 days",
    pos: "bottom-0 left-[6%] w-[44%] rotate-[2deg] z-30" },
  { thumb: "mobile" as const, title: "Mobile app design", price: "$250", rating: "4.9", delivery: "7 days",
    pos: "bottom-[6%] right-[2%] w-[44%] rotate-[-4deg] z-20" },
];

export function MarketplaceHero() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const go = (term: string = q) => {
    if (!term.trim()) return;
    void navigate({ to: "/marketplace/search", search: { q: term } as never });
  };
  return (
    <section className="brand-dark border-b border-border relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--brand-accent-cyan), var(--brand-accent-violet), transparent)" }}
      />
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-16 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center relative">
        <div>
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight leading-[1.05] text-foreground">
            Find the right freelancer
            <br />
            for any service.
          </h1>
          <p className="mt-5 text-muted-foreground max-w-xl text-base md:text-lg">
            Websites, branding, content, marketing, automation and more — delivered through TAKATAK with escrow protection on every project.
          </p>
          <div className="mt-7 max-w-xl">
            <div className="flex items-stretch rounded-lg border border-white/15 bg-white overflow-hidden focus-within:border-primary transition-colors shadow-[0_12px_40px_-20px_rgba(0,0,0,0.5)]">
              <div className="flex items-center pl-4 text-neutral-500">
                <Search size={18} />
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") go(); }}
                placeholder='Search for "logo design"'
                className="flex-1 bg-transparent outline-none px-3 py-3.5 text-[15px] min-w-0 text-neutral-900 placeholder:text-neutral-500"
              />
              <button
                onClick={() => go()}
                className="px-6 text-sm font-semibold text-primary-foreground bg-primary hover:opacity-90 transition-opacity"
              >
                Search
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 items-center text-xs">
              <span className="text-muted-foreground">Popular:</span>
              {QUICK_PICKS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setQ(p); go(p); }}
                  className="px-2.5 py-1 rounded-full border border-white/15 bg-white/5 text-foreground/90 hover:border-white/30 hover:bg-white/10 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-7 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="text-primary" />
            Escrow protection — funds only released when you approve the work.
          </div>
        </div>
        <div className="hidden lg:block">
          <div className="relative h-[520px] w-full">
            {/* soft backdrop */}
            <div className="absolute inset-6 rounded-3xl bg-white/[0.04] border border-white/10" />
            {HERO_COLLAGE.map((c) => (
              <div
                key={c.title}
                className={`absolute ${c.pos} rounded-xl border border-black/5 bg-white overflow-hidden shadow-[0_28px_56px_-24px_rgba(0,0,0,0.6)] hover:rotate-0 transition-transform duration-300`}
              >
                <ServiceThumbnail kind={c.thumb} />
                <div className="p-3">
                  <div className="text-[13px] font-semibold text-neutral-900 line-clamp-1">{c.title}</div>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-500">
                    <Star size={11} className="fill-neutral-900 text-neutral-900" />
                    <span className="font-semibold text-neutral-900">{c.rating}</span>
                    <span className="mx-1">·</span>
                    <Clock size={10} />
                    <span>{c.delivery}</span>
                  </div>
                  <div className="mt-1.5 text-[13px] font-bold text-neutral-900">From {c.price}</div>
                </div>
              </div>
            ))}
            {/* floating trust badge */}
            <div className="absolute top-[42%] left-[44%] z-40 -translate-x-1/2 -translate-y-1/2 px-3 py-2 rounded-full bg-white text-neutral-900 text-[11px] font-semibold shadow-lg inline-flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-primary" />
              TAKATAK escrow
            </div>
          </div>
        </div>
        {/* Mobile collage — stacked tilted cards */}
        <div className="lg:hidden">
          <div className="relative h-[320px] w-full mt-2">
            {HERO_COLLAGE.slice(0, 3).map((c, i) => (
              <div
                key={c.title}
                className="absolute rounded-xl border border-black/5 bg-white overflow-hidden shadow-[0_22px_44px_-18px_rgba(0,0,0,0.55)]"
                style={{
                  width: "62%",
                  left: `${i * 16}%`,
                  top: `${i * 22}px`,
                  transform: `rotate(${[-4, 2, 5][i]}deg)`,
                  zIndex: 10 + i,
                }}
              >
                <ServiceThumbnail kind={c.thumb} />
                <div className="p-2.5">
                  <div className="text-[12px] font-semibold text-neutral-900 line-clamp-1">{c.title}</div>
                  <div className="mt-1 text-[11px] font-bold text-neutral-900">From {c.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}