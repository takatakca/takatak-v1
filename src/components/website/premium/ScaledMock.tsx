"use client";

import { useEffect, useRef, useState } from "react";

import type { MockKind } from "@/lib/website/core-categories";
import { Mock } from "./mockups";

/** Design width of a mock-up (wider frames get a wider design), then scaled to fill its frame. */
const designWidth = (frame: number) => (frame >= 560 ? 540 : 400);

/**
 * Renders a product mock-up at a fixed design width and scales it to the
 * frame, so it fills the frame at 390px and at 1440px alike. The frame keeps
 * its own aspect ratio, so scaling never shifts the page layout.
 */
export function ScaledMock({ kind }: { kind: MockKind }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; scale: number; height: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width) return;
      const design = designWidth(width);
      const scale = width / design;
      setBox({ width: design, scale, height: height / scale });
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <div
        className="absolute left-0 top-0 origin-top-left p-3"
        style={
          box
            ? { width: box.width, height: box.height, transform: `scale(${box.scale})` }
            : { width: "100%", height: "100%", visibility: "hidden" }
        }
      >
        <Mock kind={kind} />
      </div>
    </div>
  );
}
