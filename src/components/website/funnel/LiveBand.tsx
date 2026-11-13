"use client";

import { ConnectorWall } from "./ConnectorWall";
import { OfferRail } from "./OfferRail";
import { ScrollScenes } from "./ScrollScenes";

/**
 * The dark band under the ask bar: the real connector ecosystem (logos and our
 * own marks, true total), small scenes that play as they cross the window,
 * then the real starting prices next to the AI sales assistant.
 */
export function LiveBand() {
  return (
    <div className="relative overflow-hidden bg-[#050B1A] text-white">
      <div aria-hidden className="hp-tech-grid opacity-60" />
      <div className="relative">
        <ConnectorWall />
        <ScrollScenes />
        <OfferRail />
      </div>
    </div>
  );
}
