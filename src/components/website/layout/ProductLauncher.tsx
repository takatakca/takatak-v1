"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGrid, Globe2, MapPin, Target, X } from "lucide-react";
import { DomainSearchOverlay } from "@/components/website/domain/DomainSearchOverlay";
import { useLanguage } from "@/lib/website/use-language";
import { useExclusiveOverlay } from "@/lib/website/overlay-manager";
import { QMAPS, FLEXS, externalLinkProps } from "@/lib/website/product-destinations";

/**
 * Compact "TAKATAK tools" launcher for narrow viewports. Groups the three
 * product shortcuts (Find my domain, QMAPS, FLEXS) behind one control.
 */
export function ProductLauncher() {
  const { t } = useLanguage();
  const { open, setOpen, toggle } = useExclusiveOverlay("launcher");
  const [domain, setDomain] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open && !domain) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setDomain(false);
      setOpen(false);
      buttonRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, domain, setOpen]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={t("nav.tools")}
        className="grid h-10 w-10 place-items-center rounded-md border border-primary/45 bg-primary/5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <LayoutGrid size={17} className="text-primary" />
      </button>

      {open && (
        <>
          <div className="fixed inset-x-0 bottom-0 top-16 z-40 bg-background/70 backdrop-blur-sm" onClick={close} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.toolsTitle")}
            className="fixed inset-x-0 top-16 z-50 mx-auto w-full max-w-md px-3 animate-scale-in"
          >
            <div className="rounded-2xl border border-border bg-popover p-3 shadow-xl">
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("nav.toolsTitle")}
                </p>
                <button type="button" onClick={close} aria-label={t("common.close")} className="rounded-md p-1 hover:bg-secondary">
                  <X size={16} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setOpen(false); setDomain(true); }}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Globe2 size={18} className="mt-0.5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{t("nav.findDomain")}</span>
                  <span className="block text-xs text-muted-foreground">{t("nav.domainDesc")}</span>
                </span>
              </button>

              <a
                href={QMAPS.productUrl}
                {...externalLinkProps}
                onClick={close}
                className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">QMAPS</span>
                  <span className="block text-xs text-muted-foreground">{t("nav.qmapsDesc")}</span>
                </span>
              </a>

              <a
                href={FLEXS.productUrl}
                {...externalLinkProps}
                onClick={close}
                className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Target size={18} className="mt-0.5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">FLEXS</span>
                  <span className="block text-xs text-muted-foreground">{t("nav.flexsDesc")}</span>
                </span>
              </a>
            </div>
          </div>
        </>
      )}

      {domain && (
        <>
          <div className="fixed inset-x-0 bottom-0 top-16 z-40 bg-background/60 backdrop-blur-sm" onClick={() => setDomain(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("domainPanel.title")}
            className="fixed inset-x-0 top-16 z-50 mx-auto w-full max-w-3xl px-3 animate-scale-in"
          >
            <DomainSearchOverlay onClose={() => { setDomain(false); buttonRef.current?.focus(); }} />
          </div>
        </>
      )}
    </>
  );
}
