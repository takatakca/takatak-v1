"use client";

import { useEffect, useRef, useState } from "react";

import { CORE_CATEGORIES } from "@/lib/website/core-categories";
import { accentStyle, useCopy } from "./ui";

export const blockId = (key: string) => `core-${key}`;

/** Keeps --tk-header-h on <html> equal to the sticky site header's height. */
export function useHeaderHeight() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header");
    if (!header) return;
    const apply = () => document.documentElement.style.setProperty("--tk-header-h", `${header.offsetHeight}px`);
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(header);
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);
}

/** Sticky category navigator for the homepage, highlighting the block in view. */
export function CategoryNavigator() {
  const { tk } = useCopy();
  const [active, setActive] = useState<string>(CORE_CATEGORIES[0].key);
  const listRef = useRef<HTMLUListElement>(null);
  useHeaderHeight();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id.replace(/^core-/, ""));
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
    );
    for (const c of CORE_CATEGORIES) {
      const el = document.getElementById(blockId(c.key));
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  // Keep the active pill visible in the horizontally scrolling list.
  useEffect(() => {
    const list = listRef.current;
    const pill = list?.querySelector<HTMLElement>(`[data-key="${active}"]`);
    if (!list || !pill) return;
    const left = pill.offsetLeft - list.clientWidth / 2 + pill.clientWidth / 2;
    list.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  return (
    <nav
      aria-label={tk("home.core.nav")}
      className="sticky z-30 border-y border-white/[0.08] bg-[#060D1F]/95 backdrop-blur-xl"
      style={{ top: "var(--tk-header-h, 64px)" }}
    >
      <div className="mx-auto max-w-7xl px-4">
        <ul ref={listRef} className="tk-no-scrollbar -mx-1 flex gap-1 overflow-x-auto py-2.5 xl:justify-between">
          {CORE_CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <li key={c.key} data-key={c.key} className="shrink-0" style={accentStyle(c)}>
                <a
                  href={`#${blockId(c.key)}`}
                  data-active={active === c.key}
                  aria-current={active === c.key ? "true" : undefined}
                  className="tk-nav-pill inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-2.5 py-1.5 text-[12.5px] font-semibold text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)]"
                >
                  <Icon size={14} className="tk-accent-text lg:hidden 2xl:inline-block" aria-hidden />
                  {c.index !== null && <span className="text-[11px] tabular-nums text-white/40">0{c.index}</span>}
                  {tk(`cat.${c.key}.name`)}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
