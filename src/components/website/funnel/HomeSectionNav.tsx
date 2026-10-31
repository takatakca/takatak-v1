"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { useHeaderHeight } from "@/components/website/premium/CategoryNavigator";
import { HOME_SECTIONS, homeCopy, type HomeSectionId } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";

export const sectionId = (id: HomeSectionId) => `home-${id}`;

/** Sticky section menu under the site header: click jumps, an underline slides to the section in view. */
export function HomeSectionNav() {
  const { lang } = useLanguage();
  const { registerHref, keys } = useHomePlan();
  const [active, setActive] = useState<HomeSectionId | null>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useHeaderHeight();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id.replace(/^home-/, "") as HomeSectionId);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.2, 0.5] },
    );
    for (const s of HOME_SECTIONS) {
      const el = document.getElementById(sectionId(s.id));
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    const link = active ? list?.querySelector<HTMLElement>(`[data-id="${active}"] a`) : null;
    if (!list || !link) {
      setBar(null);
      return;
    }
    setBar({ left: link.offsetLeft, width: link.offsetWidth });
    list.scrollTo({ left: link.offsetLeft - list.clientWidth / 2 + link.offsetWidth / 2, behavior: "smooth" });
  }, [active, lang]);

  const jump = (id: HomeSectionId) => {
    document.getElementById(sectionId(id))?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${sectionId(id)}`);
    setActive(id);
  };

  return (
    <nav
      aria-label={homeCopy.nav.label[lang]}
      className="sticky z-30 border-b border-white/[0.07] bg-[#060D1F]/80 backdrop-blur-2xl backdrop-saturate-150"
      style={{ top: "var(--tk-header-h, 64px)" }}
    >
      <div className="mx-auto flex h-[52px] max-w-7xl items-center gap-4 px-4">
        <ul ref={listRef} className="tk-no-scrollbar relative flex h-full flex-1 items-center gap-7 overflow-x-auto">
          {HOME_SECTIONS.map((s) => {
            const on = active === s.id;
            return (
              <li key={s.id} data-id={s.id} className="flex h-full shrink-0 items-center">
                <a
                  href={`#${sectionId(s.id)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    jump(s.id);
                  }}
                  aria-current={on ? "true" : undefined}
                  className={`whitespace-nowrap text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29C3FF] ${
                    on ? "text-white" : "text-white/50 hover:text-white"
                  }`}
                >
                  {s.label[lang]}
                </a>
              </li>
            );
          })}
          {bar && (
            <li
              aria-hidden
              className="pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-[#29C3FF] shadow-[0_0_12px_#29C3FF] transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{ left: bar.left, width: bar.width }}
            />
          )}
        </ul>
        <Link
          to={registerHref}
          className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-[#060D1F] transition-transform hover:scale-[1.03] md:inline-flex"
        >
          {homeCopy.nav.start[lang]}
          {keys.length > 0 && <span className="rounded-full bg-[#1565D8] px-1.5 text-[11px] font-bold text-white">{keys.length}</span>}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
