"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

import manifest from "@/lib/website/media-manifest.json";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";

const VIDEOS = (manifest as { videos: Record<string, string> }).videos;

/**
 * A photo that slowly moves (Ken Burns), replaced by a short muted video loop
 * as soon as one exists for `videoKey` in media-manifest.json. The video only
 * loads when the frame is near the viewport and never plays with reduced motion.
 */
export function MediaLoop({
  photo,
  alt,
  videoKey,
  focus = "50% 50%",
  zoom = 1,
  sizes = "100vw",
  className = "",
  priority = false,
}: {
  photo: string;
  alt: string;
  videoKey?: string;
  /** object-position of the photo, so one picture can frame different subjects. */
  focus?: string;
  /** Extra scale for tighter crops. */
  zoom?: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const src = videoKey ? VIDEOS[videoKey] : undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el || !src || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  return (
    <div ref={ref} className={`hp-photo ${/\babsolute\b/.test(className) ? "" : "relative"} ${className}`}>
      <div className={reduced ? "absolute inset-0" : "hp-kenburns absolute inset-0"} style={{ transform: zoom !== 1 ? `scale(${zoom})` : undefined }}>
        <Image src={photo} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" style={{ objectPosition: focus }} />
      </div>
      {src && near && !reduced && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
        />
      )}
    </div>
  );
}

/** Services that have a 7 s vertical clip in public/media/social (scripts/media/make-clips.py). */
export const CLIP_KEYS = new Set(["website", "domains", "hosting", "marketing", "social", "local", "reviews", "billing"]);

/** Full-screen pop-up that plays a service's vertical clip, with sound controls. */
export function ClipModal({ clip, lang, onClose }: { clip: string; lang: "en" | "fr"; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={clip}>
      <div className="tk-fade-in absolute inset-0 bg-[#02040A]/85 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div className="tk-modal-in relative overflow-hidden rounded-[28px] shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9)]">
        <video className="block aspect-[9/16] max-h-[86vh] w-auto bg-black" src={`/media/social/${clip}-${lang}.mp4`} autoPlay muted loop playsInline controls />
        <button
          type="button"
          onClick={onClose}
          aria-label={lang === "fr" ? "Fermer" : "Close"}
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#0B0D12] hover:bg-white"
        >
          ✕
        </button>
      </div>
    </div>,
    document.querySelector(".website-surface") ?? document.body,
  );
}

/** A play button laid over a picture. */
export function PlayBadge({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#0B0D12] shadow-[0_12px_40px_-10px_rgb(0_0_0/0.6)] backdrop-blur transition-transform duration-500 group-hover:scale-110">
      <span aria-hidden className="ml-1 block h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-current" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
