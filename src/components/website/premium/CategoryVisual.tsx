"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";

import type { CoreCategory } from "@/lib/website/core-categories";
import { Mock } from "./mockups";
import { IllustrationTag, SegmentedTabs, accentStyle, useCopy } from "./ui";

/**
 * A category's switchable views (real images and product mock-ups) in a
 * glass frame. Every view shares one aspect ratio, so switching never shifts
 * the layout; images zoom on hover inside the overflow-hidden frame.
 */
export function CategoryVisual({
  category,
  idBase,
  sizes = "(min-width: 1280px) 640px, (min-width: 1024px) 52vw, 100vw",
  preload = false,
  overlay,
  className = "",
}: {
  category: CoreCategory;
  idBase: string;
  sizes?: string;
  preload?: boolean;
  /** Extra layered element (e.g. a floating card) placed over the frame. */
  overlay?: ReactNode;
  className?: string;
}) {
  const { tk } = useCopy();
  const [viewId, setViewId] = useState(category.views[0].id);
  const view = category.views.find((v) => v.id === viewId) ?? category.views[0];
  const items = category.views.map((v) => ({ id: v.id, label: tk(`cat.${category.key}.view.${v.id}`) }));

  return (
    <div className={className} style={accentStyle(category)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {items.length > 1 ? (
          <SegmentedTabs
            items={items}
            value={view.id}
            onChange={setViewId}
            idBase={idBase}
            label={`${tk(`cat.${category.key}.name`)} · ${tk("cat.common.views")}`}
          />
        ) : (
          <span />
        )}
        <p className="hidden text-xs text-white/55 sm:block">{tk(`cat.${category.key}.cap.${view.id}`)}</p>
      </div>

      <div className="group relative">
        <div aria-hidden className="tk-accent-glow pointer-events-none absolute -inset-8 opacity-50" />
        <div
          id={`${idBase}-panel`}
          role={items.length > 1 ? "tabpanel" : undefined}
          aria-labelledby={items.length > 1 ? `${idBase}-tab-${view.id}` : undefined}
          className="tk-glass relative rounded-[24px] p-2 sm:p-2.5"
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#081430] sm:aspect-[16/10]">
            <div key={view.id} className="tk-view absolute inset-0">
              {view.image ? (
                <div className="tk-zoom absolute inset-0">
                  <Image
                    src={view.image.src}
                    alt={tk(`cat.${category.key}.alt.${view.id}`)}
                    fill
                    sizes={sizes}
                    preload={preload}
                    className="object-cover"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgb(6_13_31/0.55)),linear-gradient(120deg,color-mix(in_oklab,var(--tk-accent)_18%,transparent),transparent_45%)]"
                  />
                </div>
              ) : (
                <div className="absolute inset-0 p-2.5 sm:p-4">
                  {view.mock && <Mock kind={view.mock} />}
                  <IllustrationTag className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4" />
                </div>
              )}
            </div>
          </div>
        </div>
        {overlay}
      </div>
      <p className="mt-3 text-xs text-white/55 sm:hidden">{tk(`cat.${category.key}.cap.${view.id}`)}</p>
    </div>
  );
}
