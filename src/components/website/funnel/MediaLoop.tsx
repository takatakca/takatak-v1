"use client";

import { useEffect, useRef, useState } from "react";
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
    <div ref={ref} className={`hp-photo ${className}`}>
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
