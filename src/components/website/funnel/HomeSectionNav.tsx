"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { useHeaderHeight } from "@/components/website/premium/CategoryNavigator";
import { HOME_SECTIONS, homeCopy, type HomeSectionId } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";

export const sectionId = (id: HomeSectionId) => `home-${id}`;

/** Sticky section menu under the site header: click jumps, the section in view lights up. */
export function HomeSectionNav() {
  const { lang } = useLanguage();
  const { registerHref } = useHomePlan();
  const [active, setActive] = useState<HomeSectionId>("services");
  const listRef = useRef<HTMLUListElement>(null);
  useHeaderHeight();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id.replace(/^home-/, "") as HomeSectionId);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.2, 0.5] },
    );
    for (const s of HOME_SECTIONS) {
      const el = document.getElementById(sectionId(s.id));
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const pill = list?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!list || !pill) return;
    list.scrollTo({ left: pill.offsetLeft - list.clientWidth / 2 + pill.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  const jump = (id: HomeSectionId) => {
    const el = document.getElementById(sectionId(id));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${sectionId(id)}`);
    setActive(id);
  };

  return (
    <nav
      aria-label={homeCopy.nav.label[lang]}
      className="sticky z-30 border-y border-white/[0.08] bg-[#060D1F]/90 backdrop-blur-xl"
      style={{ top: "var(--tk-header-h, 64px)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4">
        <ul ref={listRef} className="tk-no-scrollbar flex flex-1 gap-1 overflow-x-auto py-2.5">
          {HOME_SECTIONS.map((s, i) => {
            const on = active === s.id;
            return (
              <li key={s.id} data-id={s.id} className="shrink-0">
                <a
                  href={`#${sectionId(s.id)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    jump(s.id);
                  }}
                  aria-current={on ? "true" : undefined}
                  className={`relative inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)] ${
                    on ? "bg-[var(--tk-blue,#1F8BFF)] text-white shadow-[0_8px_24px_-10px_#1F8BFF]" : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className={`text-[10.5px] tabular-nums ${on ? "text-white/80" : "text-white/35"}`}>0{i + 1}</span>
                  {s.label[lang]}
                </a>
              </li>
            );
          })}
        </ul>
        <Link
          to={registerHref}
          className="tk-btn-primary hidden shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold md:inline-flex"
        >
          {homeCopy.nav.start[lang]} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
