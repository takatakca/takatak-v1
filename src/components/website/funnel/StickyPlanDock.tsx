"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ShoppingBag, X } from "lucide-react";

import { useCopy } from "@/components/website/premium/ui";
import { fill, homeCopy } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { PlanPrice } from "./PlanBuilder";
import { sectionId } from "./HomeSectionNav";

/**
 * Always-visible plan bar once the visitor scrolls past the hero: what is in
 * the plan, its starting price, and the next step. Hides again near the footer.
 */
export function StickyPlanDock() {
  const { tk, lang } = useCopy();
  const plan = useHomePlan();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const start = document.getElementById(sectionId("services"));
      const footer = document.querySelector("footer");
      const y = window.scrollY + window.innerHeight;
      const past = start ? window.scrollY > start.offsetTop - window.innerHeight * 0.5 : window.scrollY > 900;
      const nearFooter = footer ? y > footer.offsetTop + 80 : false;
      setVisible(past && !nearFooter);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const count = plan.keys.length;
  const goPlan = () => document.getElementById(sectionId("plan"))?.scrollIntoView({ behavior: "smooth" });

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-20 z-40 flex justify-center px-3 transition-all duration-500 sm:bottom-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
    >
      <div
        role="region"
        aria-label={homeCopy.dock.label[lang]}
        className="flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-white/12 bg-[#0B1B3D]/90 p-2 pl-3 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8),0_0_0_1px_rgb(31_139_255/0.25)] backdrop-blur-xl sm:mr-40 sm:pl-4"
      >
        <span aria-hidden className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1F8BFF]/20 text-[#7CC4FF]">
          <ShoppingBag size={17} />
          {count > 0 && (
            <span key={count} className="tk-pop absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#1F8BFF] px-1 text-[11px] font-bold text-white">
              {count}
            </span>
          )}
        </span>
        <button type="button" onClick={goPlan} tabIndex={visible ? 0 : -1} className="min-w-0 flex-1 text-left">
          {count ? (
            <>
              <span className="block truncate text-[13px] font-semibold text-white">
                {count === 1 ? homeCopy.dock.service[lang] : fill(homeCopy.dock.services[lang], { n: count })}
                <span className="font-normal text-white/50"> · {plan.categories.map((c) => tk(`cat.${c.key}.name`)).join(", ")}</span>
              </span>
              <span className="block text-[12.5px]">
                <PlanPrice compact />
              </span>
            </>
          ) : (
            <span className="block truncate text-[13.5px] font-semibold text-white">{homeCopy.dock.empty[lang]}</span>
          )}
        </button>
        {count > 0 && (
          <button
            type="button"
            onClick={plan.clear}
            tabIndex={visible ? 0 : -1}
            aria-label={homeCopy.dock.clear[lang]}
            className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-white sm:grid"
          >
            <X size={15} aria-hidden />
          </button>
        )}
        {count ? (
          <Link
            to={plan.registerHref}
            tabIndex={visible ? 0 : -1}
            className="tk-btn-primary inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold"
          >
            {homeCopy.dock.cta[lang]} <ArrowRight size={15} aria-hidden />
          </Link>
        ) : (
          <button
            type="button"
            onClick={goPlan}
            tabIndex={visible ? 0 : -1}
            className="tk-btn-primary inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold"
          >
            {homeCopy.dock.build[lang]} <ArrowRight size={15} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
