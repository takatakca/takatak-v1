"use client";

import { useEffect } from "react";

import { DomainSearchOverlay } from "@/components/website/domain/DomainSearchOverlay";

/**
 * Opens the existing TAKATAK domain search panel (live registration layer,
 * with the managed request fallback) in a dialog, from any page section.
 */
export function DomainSearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-20 sm:pt-28" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#060D1F]/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="brand-dark relative w-full max-w-2xl animate-scale-in" style={{ background: "transparent" }}>
        <DomainSearchOverlay onClose={onClose} />
      </div>
    </div>
  );
}
