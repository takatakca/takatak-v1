"use client";

import { useEffect, useRef } from "react";
import { Globe2 } from "lucide-react";
import { DomainSearchOverlay } from "@/components/website/domain/DomainSearchOverlay";
import { HeaderProductButton } from "@/components/website/layout/HeaderProductAction";
import { useLanguage } from "@/lib/website/use-language";
import { useExclusiveOverlay } from "@/lib/website/overlay-manager";

/**
 * "Find my domain" header action. Opens the TAKATAK domain panel directly
 * beneath the header instead of navigating away.
 */
export function HeaderDomainSearch({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const { open, setOpen, toggle } = useExclusiveOverlay("domain");
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      <HeaderProductButton
        ref={buttonRef}
        onClick={toggle}
        expanded={open}
        compact={compact}
        label={t("nav.findDomain")}
        tooltip={t("nav.domainDesc")}
        icon={Globe2}
      />

      {open && (
        <>
          <div
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("domainPanel.title")}
            className="fixed inset-x-0 top-16 z-50 mx-auto w-full max-w-3xl px-3 animate-scale-in sm:px-4"
          >
            <DomainSearchOverlay onClose={() => { setOpen(false); buttonRef.current?.focus(); }} />
          </div>
        </>
      )}
    </>
  );
}