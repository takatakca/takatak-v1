"use client";

import { HeroChat } from "@/components/website/funnel/HeroChat";
import { NavyBackdrop } from "./ui";

// Owner (Nov 20 2026): no marketing text on the left. The top of the homepage
// is TAK-TAK, a full chat workspace across the whole width of the screen.
/** Homepage hero: TAK-TAK, the TAKATAK assistant, as a full chat workspace. */
export function PremiumHero() {
  return (
    <section aria-labelledby="home-hero-title" className="relative overflow-x-clip">
      <NavyBackdrop grid />
      <div className="relative mx-auto w-full max-w-[1440px] px-3 pb-12 pt-3 sm:px-5 sm:pt-4 lg:px-8 lg:pb-16">
        <HeroChat />
      </div>
    </section>
  );
}
