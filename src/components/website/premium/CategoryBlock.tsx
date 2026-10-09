"use client";

import { ArrowRight, Check, Clock3 } from "lucide-react";

import { Reveal } from "@/components/website/home/Reveal";
import { CORE_CATEGORIES, type CoreCategory } from "@/lib/website/core-categories";
import { Link } from "@/lib/website/nav";
import { blockId } from "./CategoryNavigator";
import { CategoryVisual } from "./CategoryVisual";
import { AvailabilityBadge, CategoryIcon, FromLine, accentStyle, useCopy } from "./ui";

/** One rich homepage block for a core category: promise, highlights, price and switchable visuals. */
export function CategoryBlock({ category, reverse = false }: { category: CoreCategory; reverse?: boolean }) {
  const { tk } = useCopy();
  const id = blockId(category.key);
  const name = tk(`cat.${category.key}.name`);

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="relative overflow-hidden py-16 sm:py-24"
      style={{ ...accentStyle(category), scrollMarginTop: "calc(var(--tk-header-h, 64px) + 56px)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--tk-accent)_55%,transparent),transparent)]" />
      <div
        aria-hidden
        className={`pointer-events-none absolute top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full opacity-40 blur-3xl ${
          reverse ? "-left-40" : "-right-40"
        }`}
        style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--tk-accent) 40%, transparent), transparent)" }}
      />
      {category.index !== null && (
        <span
          aria-hidden
          className={`tk-number-outline pointer-events-none absolute top-0 hidden -translate-y-[22%] select-none text-[200px] font-extrabold leading-none opacity-[0.16] lg:block ${
            reverse ? "right-[4%]" : "left-[2%]"
          }`}
        >
          0{category.index}
        </span>
      )}

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-12 lg:gap-14">
        <Reveal className={`lg:col-span-5 ${reverse ? "lg:order-2" : ""}`}>
          <div className="flex flex-wrap items-center gap-3">
            <CategoryIcon category={category} />
            <div className="min-w-0">
              <p className="tk-accent-text text-[11px] font-semibold uppercase tracking-[0.22em]">
                {category.index !== null ? tk("cat.common.number", { n: category.index }) : tk("cat.common.start")}
              </p>
              <p className="text-lg font-bold text-white">{name}</p>
            </div>
            <AvailabilityBadge availability={category.availability} className="sm:ml-auto" />
          </div>

          <h2 id={`${id}-title`} className="mt-6 text-balance text-[28px] font-extrabold leading-[1.1] tracking-[-0.025em] text-white sm:text-[38px]">
            {tk(`cat.${category.key}.headline`)}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-white/70">{tk(`cat.${category.key}.promise`)}</p>

          <ul className="mt-6 grid gap-2.5">
            {(["h1", "h2", "h3"] as const).map((h) => (
              <li key={h} className="flex items-start gap-3 text-[15px] text-white/88">
                <span aria-hidden className="tk-accent-soft mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full">
                  {category.availability === "planned" ? (
                    <Clock3 size={12} className="tk-accent-text" />
                  ) : (
                    <Check size={12} className="tk-accent-text" strokeWidth={3} />
                  )}
                </span>
                {tk(`cat.${category.key}.${h}`)}
              </li>
            ))}
          </ul>

          {category.chips && (
            <div className="mt-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{tk("cat.chips.label")}</p>
              <ul className="flex flex-wrap gap-1.5">
                {category.chips.map((chip) => (
                  <li
                    key={chip.label}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      chip.soon ? "border-dashed border-white/20 text-white/50" : "border-white/14 bg-white/[0.05] text-white/85"
                    }`}
                  >
                    {chip.label}
                    {chip.soon && <span className="ml-1 text-[10px] uppercase tracking-wider text-amber-200/80">· {tk("cat.soon")}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              to={category.route}
              className="group/cta inline-flex items-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--tk-accent)_55%,transparent)] bg-[color-mix(in_oklab,var(--tk-accent)_18%,transparent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_-18px_var(--tk-accent)] transition-colors hover:bg-[color-mix(in_oklab,var(--tk-accent)_30%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)]"
            >
              {tk("cat.common.explore", { name })}
              <ArrowRight size={16} className="transition-transform group-hover/cta:translate-x-0.5" aria-hidden />
            </Link>
            <FromLine category={category} className="text-sm" />
          </div>
        </Reveal>

        <Reveal className={`lg:col-span-7 ${reverse ? "lg:order-1" : ""}`} delay={120}>
          <CategoryVisual category={category} idBase={`home-${category.key}`} />
        </Reveal>
      </div>
    </section>
  );
}

/** All core category blocks, alternating sides (website first, then 01–09). */
export function CoreCategoryBlocks() {
  return (
    <>
      {CORE_CATEGORIES.map((category, i) => (
        <CategoryBlock key={category.key} category={category} reverse={i % 2 === 1} />
      ))}
    </>
  );
}
