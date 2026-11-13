"use client";

import { ArrowRight, Headset } from "lucide-react";

import { useCopy } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { homeV3 } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { Magnetic, PointHere, RevealMedia, Rise } from "./primitives";
import { SceneReel } from "./SceneReel";

/** The last screen: a full-width brand-blue band, one promise, three ways to start. */
export function FinalChapter() {
  const { tk, lang } = useCopy();
  const { registerHref } = useHomePlan();
  return (
    <section aria-labelledby="final-title" className="hp-bg hp-live px-4 pb-16 pt-4 sm:pb-24">
      <Rise className="mx-auto max-w-7xl">
        <div className="grid overflow-hidden rounded-[32px] bg-[#1565D8] text-white lg:grid-cols-2">
          <div className="flex flex-col justify-center p-8 sm:p-14 lg:p-16">
            <h2 id="final-title" className="hp-display text-balance text-[40px] sm:text-[56px] lg:text-[64px]">
              {homeV3.final.title[lang]}
            </h2>
            <p className="mt-6 max-w-lg text-[17px] leading-8 text-white/85">{homeV3.final.body[lang]}</p>
            <div className="relative mt-14 flex flex-wrap items-center gap-3">
              <PointHere label={lang === "fr" ? "Cliquez ici" : "Click here"} color="#FFFFFF" className="-top-16 left-6" />
              <Magnetic>
              <Link
                to={registerHref}
                className="hp-halo inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-[16px] font-semibold text-[#0B0D12] transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1565D8]"
              >
                {tk("home.p.ctaStart")} <ArrowRight size={17} aria-hidden />
              </Link>
              </Magnetic>
              <Link to="/marketplace/post-project" className="inline-flex items-center gap-2 rounded-full px-6 py-4 text-[16px] font-semibold text-white ring-1 ring-white/50 hover:bg-white/10">
                {tk("home.pf.quote")}
              </Link>
              <button
                type="button"
                onClick={() => openLiveChat({ page: "/", intent: "final_cta", lang })}
                className="inline-flex items-center gap-2 px-3 py-4 text-[16px] font-semibold text-white/90 underline-offset-4 hover:underline"
              >
                <Headset size={17} aria-hidden /> {tk("home.final.cta3")}
              </button>
            </div>
          </div>
          <RevealMedia radius={0} className="min-h-[440px] sm:min-h-[400px] lg:min-h-[560px]">
            <SceneReel />
          </RevealMedia>
        </div>
      </Rise>
    </section>
  );
}
