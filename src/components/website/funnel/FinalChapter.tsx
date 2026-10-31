"use client";

import { ArrowRight, Headset } from "lucide-react";

import { useCopy } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { Aurora, Rise } from "./primitives";

/** The last screen: one big promise and the three ways to start. */
export function FinalChapter() {
  const { tk, lang } = useCopy();
  const { registerHref } = useHomePlan();
  return (
    <section aria-labelledby="final-title" className="tk-grain relative overflow-hidden border-t border-white/[0.06] bg-[#030812] py-28 sm:py-40">
      <div aria-hidden className="absolute inset-0 opacity-80">
        <Aurora colors={["#1F8BFF", "#29C3FF", "#6A5BFF"]} />
      </div>
      <Rise className="relative mx-auto max-w-5xl px-4 text-center">
        <h2 id="final-title" className="text-balance font-[family-name:var(--font-website-display)] text-[44px] font-bold leading-[0.98] tracking-[-0.045em] text-white sm:text-[80px] lg:text-[96px]">
          {tk("home.pf.title")}
        </h2>
        <p className="mx-auto mt-7 max-w-2xl text-[17px] leading-8 text-white/60">{tk("home.pf.subtitle")}</p>
        <div className="mt-11 flex flex-wrap items-center justify-center gap-3">
          <Link to={registerHref} className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-[16px] font-semibold text-[#060D1F] shadow-[0_20px_60px_-20px_#29C3FF] transition-transform hover:scale-[1.03]">
            {tk("home.p.ctaStart")} <ArrowRight size={17} aria-hidden />
          </Link>
          <Link to="/marketplace/post-project" className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-[16px] font-semibold text-white ring-1 ring-white/25 hover:bg-white/[0.07]">
            {tk("home.pf.quote")}
          </Link>
          <button
            type="button"
            onClick={() => openLiveChat({ page: "/", intent: "final_cta", lang })}
            className="inline-flex items-center gap-2 px-4 py-4 text-[16px] font-semibold text-white/75 hover:text-white"
          >
            <Headset size={17} className="text-[#29C3FF]" aria-hidden /> {tk("home.final.cta3")}
          </button>
        </div>
      </Rise>
    </section>
  );
}
