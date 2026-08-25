"use client";

import { Link } from "@/lib/website/nav";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { externalLinkProps } from "@/lib/website/product-destinations";
import type { StageWorld } from "@/lib/website/stage-worlds";

/** Sales panel for the active stage: eyebrow, headline, one line, signals, CTAs. */
export function StageInformation({ world }: { world: StageWorld }) {
  const { tx } = useLanguage();

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">{tx(world.eyebrow)}</p>
      <h3 className="mt-3 text-2xl font-bold leading-tight text-foreground md:text-4xl">{tx(world.headline)}</h3>
      <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{tx(world.support)}</p>

      <ul className="mt-5 flex flex-wrap gap-2">
        {world.signals.map((s) => (
          <li
            key={s.en}
            className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-foreground/85"
          >
            {tx(s)}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to={world.primary.to as never}
          className="tk-glow-cta inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {tx(world.primary.label)} <ArrowRight size={15} aria-hidden />
        </Link>
        <Link
          to={world.secondary.to as never}
          className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-foreground hover:bg-white/10"
        >
          {tx(world.secondary.label)}
        </Link>
      </div>

      <ul className="mt-5 flex flex-wrap gap-2">
        {world.contextual.map((c) =>
          c.external ? (
            <li key={c.to}>
              <a
                href={c.to}
                {...externalLinkProps}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-foreground/85 hover:border-primary/40 hover:bg-white/[0.08]"
              >
                {tx(c.label)} <ArrowUpRight size={12} aria-hidden />
              </a>
            </li>
          ) : (
            <li key={c.to}>
              <Link
                to={c.to as never}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-foreground/85 hover:border-primary/40 hover:bg-white/[0.08]"
              >
                {tx(c.label)}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}