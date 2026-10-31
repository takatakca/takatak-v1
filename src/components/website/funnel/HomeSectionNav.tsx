"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Moon, Sun } from "lucide-react";

import { useHeaderHeight } from "@/components/website/premium/CategoryNavigator";
import { HOME_SECTIONS, homeCopy, type HomeSectionId } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { useHomeTheme } from "@/lib/website/home-theme";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";

export const sectionId = (id: HomeSectionId) => `home-${id}`;

const THEME_LABEL = {
  light: { en: "Switch to dark mode", fr: "Passer au mode sombre" },
  dark: { en: "Switch to light mode", fr: "Passer au mode clair" },
};

/** Sticky section menu under the site header: click jumps, an underline follows the section in view. */
export function HomeSectionNav() {
  const { lang } = useLanguage();
  const { theme, toggle } = useHomeTheme();
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
      className="hp-line sticky z-30 border-b backdrop-blur-xl backdrop-saturate-150"
      style={{ top: "var(--tk-header-h, 64px)", background: "color-mix(in oklab, var(--hp-bg) 96%, transparent)" }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
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
                  className={`hp-focus whitespace-nowrap text-[14px] font-medium transition-colors ${on ? "hp-ink" : "hp-ink-3 hover:text-[var(--hp-ink)]"}`}
                >
                  {s.label[lang]}
                </a>
              </li>
            );
          })}
          {bar && (
            <li
              aria-hidden
              className="pointer-events-none absolute bottom-0 h-[2px] bg-[var(--hp-ink)] transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{ left: bar.left, width: bar.width }}
            />
          )}
        </ul>
        <button
          type="button"
          onClick={toggle}
          aria-label={THEME_LABEL[theme][lang]}
          title={THEME_LABEL[theme][lang]}
          className="hp-ghost hp-focus grid h-9 w-9 shrink-0 place-items-center rounded-full"
        >
          {theme === "light" ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
        </button>
        <Link to={registerHref} className="hp-btn hp-focus hidden shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold md:inline-flex">
          {homeCopy.nav.start[lang]}
          {keys.length > 0 && <span className="rounded-full bg-[var(--hp-cta)] px-1.5 text-[11px] font-bold text-white">{keys.length}</span>}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
