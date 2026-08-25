"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { motion } from "@/lib/website/motion-config";

interface Options {
  once?: boolean;
  threshold?: number;
  rootMargin?: string;
}

export function useInViewport<T extends HTMLElement>(
  options: Options = {},
): [RefObject<T | null>, boolean] {
  const {
    once = true,
    threshold = motion.viewport.threshold,
    rootMargin = motion.viewport.rootMargin,
  } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) io.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold, rootMargin]);

  return [ref, inView];
}
