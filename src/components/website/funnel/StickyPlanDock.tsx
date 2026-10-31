"use client";

import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";

import { money, useCopy } from "@/components/website/premium/ui";
import { fill, homeCopy } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { sectionId } from "./HomeSectionNav";

/**
 * A slim plan bar that rises once the visitor passes the hero and hides near
 * the footer: what is in the plan, its starting price, and the next step.
 */
export function StickyPlanDock() {
  const { lang } = useCopy();
  const plan = useHomePlan();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const start = document.getElementById(sectionId("services"));
      const footer = document.querySelector("footer");
      const past = start ? window.scrollY > start.offsetTop - window.innerHeight * 0.4 : false;
      const nearFooter = footer ? window.scrollY + window.innerHeight > footer.offsetTop + 80 : false;
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
  const t = plan.totals;
  const price = t.monthly
    ? `${money(lang, t.monthly)} ${homeCopy.plan.monthly[lang]}`
    : t.yearly
      ? `${money(lang, t.yearly)} ${homeCopy.plan.yearly[lang]}`
      : t.oneTime
        ? `${money(lang, t.oneTime)} ${homeCopy.plan.oneTime[lang]}`
        : null;
  const goPlan = () => document.getElementById(sectionId("plan"))?.scrollIntoView({ behavior: "smooth" });
  const tab = visible ? 0 : -1;

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-20 z-40 flex justify-center px-3 transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] sm:bottom-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0"
      }`}
    >
      <div
        role="region"
        aria-label={homeCopy.dock.label[lang]}
        className="flex w-full max-w-xl items-center gap-2 rounded-full bg-[#F5F8FC] p-1.5 pl-5 text-[#060D1F] shadow-[0_24px_70px_-20px_rgb(0_0_0/0.85),0_0_0_1px_rgb(255_255_255/0.4)] sm:mr-36"
      >
        <button type="button" onClick={goPlan} tabIndex={tab} className="min-w-0 flex-1 text-left">
          {count ? (
            <span className="block truncate text-[13.5px]">
              <span className="font-semibold">{count === 1 ? homeCopy.dock.service[lang] : fill(homeCopy.dock.services[lang], { n: count })}</span>
              {price && <span className="text-[#060D1F]/55"> · {price}</span>}
            </span>
          ) : (
            <span className="block truncate text-[13.5px] font-semibold">{homeCopy.dock.empty[lang]}</span>
          )}
        </button>
        {count > 0 && (
          <button
            type="button"
            onClick={plan.clear}
            tabIndex={tab}
            aria-label={homeCopy.dock.clear[lang]}
            className="hidden h-9 w-9 shrink-0 place-items-center rounded-full text-[#060D1F]/45 hover:bg-[#060D1F]/[0.06] hover:text-[#060D1F] sm:grid"
          >
            <X size={15} aria-hidden />
          </button>
        )}
        {count ? (
          <Link to={plan.registerHref} tabIndex={tab} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1565D8] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#0F55BD]">
            {homeCopy.dock.cta[lang]} <ArrowRight size={15} aria-hidden />
          </Link>
        ) : (
          <button type="button" onClick={goPlan} tabIndex={tab} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#060D1F] px-5 py-2.5 text-[13.5px] font-semibold text-white">
            {homeCopy.dock.build[lang]} <ArrowRight size={15} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
