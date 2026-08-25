/**
 * TAKATAK shared motion configuration.
 * Every animated component reads its timing, easing and depth values from
 * here so the whole site moves with one precise, professional character.
 */
export const motion = {
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  duration: { fast: 220, base: 420, slow: 700 },
  /** Delay between staggered children, in ms. */
  stagger: 90,
  /** Maximum pointer tilt, in degrees. */
  tilt: 6,
  /** Float travel distance, in px. */
  float: 10,
  /** IntersectionObserver activation threshold + margin. */
  viewport: { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  /** Ecosystem story: ms per step and pause before the loop restarts. */
  story: { step: 1900, restPause: 1600 },
} as const;

export type RevealVariant =
  | "fade-up"
  | "fade-in"
  | "slide-left"
  | "slide-right"
  | "scale-in";
