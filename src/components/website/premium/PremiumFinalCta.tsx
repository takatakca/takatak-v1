"use client";

import { ArrowRight, Headset, PenLine } from "lucide-react";

import { Reveal } from "@/components/website/home/Reveal";
import { openLiveChat } from "@/lib/website/chat-provider";
import { Link } from "@/lib/website/nav";
import { useCopy } from "./ui";

/** Closing call to action: create an account, describe a project, or talk to the team. */
export function PremiumFinalCta({
  title,
  subtitle,
  page = "/",
}: {
  title?: string;
  subtitle?: string;
  page?: string;
}) {
  const { tk, lang } = useCopy();
  return (
    <section aria-labelledby="final-cta-title" className="px-4 pb-20 pt-4 sm:pb-28">
      <Reveal className="relative mx-auto max-w-[1248px]">
        <div className="tk-glow-cta rounded-[32px]">
          <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0B1B3D,#08142E_55%,#0D2350)] px-6 py-14 text-center sm:px-10 sm:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(620px 280px at 50% -10%, rgb(41 195 255 / 0.25), transparent 65%), radial-gradient(520px 260px at 85% 120%, rgb(155 92 255 / 0.22), transparent 60%), radial-gradient(520px 260px at 10% 120%, rgb(31 139 255 / 0.25), transparent 60%)",
              }}
            />
            <div aria-hidden className="tk-dot-map pointer-events-none absolute inset-0" />
            <div className="relative mx-auto max-w-3xl">
              <h2 id="final-cta-title" className="tk-gradient-text text-balance text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-5xl">
                {title ?? tk("home.pf.title")}
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/70">{subtitle ?? tk("home.pf.subtitle")}</p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link to="/register" className="tk-btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold">
                  {tk("home.p.ctaStart")} <ArrowRight size={16} aria-hidden />
                </Link>
                <Link to="/marketplace/post-project" className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold">
                  <PenLine size={16} aria-hidden /> {tk("home.pf.quote")}
                </Link>
                <button
                  type="button"
                  onClick={() => openLiveChat({ page, intent: "final_cta", lang })}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-3.5 text-[15px] font-semibold text-white/80 hover:text-white"
                >
                  <Headset size={16} className="text-[var(--tk-cyan)]" aria-hidden /> {tk("home.final.cta3")}
                </button>
              </div>
              <p className="mt-7 text-sm font-medium text-white/55">{tk("home.final.close")}</p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
