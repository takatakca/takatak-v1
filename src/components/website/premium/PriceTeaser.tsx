"use client";

import { ArrowRight, ArrowUpRight } from "lucide-react";

import { Reveal } from "@/components/website/home/Reveal";
import { CORE_CATEGORIES } from "@/lib/website/core-categories";
import { Link } from "@/lib/website/nav";
import { CategoryIcon, FromLine, Kicker, accentStyle, useCopy } from "./ui";

/** Starting price per core category, straight from the code catalogs. */
export function PriceTeaser() {
  const { tk } = useCopy();
  return (
    <section aria-labelledby="home-pt-title" className="relative border-t border-white/[0.08] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <Reveal className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Kicker>{tk("home.pt.kicker")}</Kicker>
            <h2 id="home-pt-title" className="mt-4 text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-[40px]">
              {tk("home.pt.title")}
            </h2>
            <p className="mt-3 text-base leading-7 text-white/65">{tk("home.pt.subtitle")}</p>
          </div>
          <Link
            to="/pricing"
            className="tk-btn-ghost inline-flex shrink-0 items-center gap-2 self-start rounded-xl px-5 py-3 text-sm font-semibold md:self-auto"
          >
            {tk("home.pt.all")} <ArrowRight size={15} aria-hidden />
          </Link>
        </Reveal>

        <ul className="mt-10 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-5">
          {CORE_CATEGORIES.map((c, i) => (
            <Reveal as="li" key={c.key} delay={(i % 5) * 60}>
              <Link
                to={c.route}
                style={accentStyle(c)}
                className="tk-glass tk-lift group flex h-full flex-col rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)]"
              >
                <div className="flex items-center justify-between">
                  <CategoryIcon category={c} size={38} />
                  <ArrowUpRight size={16} className="text-white/35 transition-colors group-hover:text-white" aria-hidden />
                </div>
                <p className="mt-4 text-[15px] font-bold text-white">{tk(`cat.${c.key}.name`)}</p>
                <FromLine category={c} className="mt-1 text-[13px] text-white/70" />
              </Link>
            </Reveal>
          ))}
        </ul>
        <p className="mt-6 text-xs text-white/45">{tk("cat.price.note")}</p>
      </div>
    </section>
  );
}
