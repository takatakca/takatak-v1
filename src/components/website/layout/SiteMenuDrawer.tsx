"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/lib/website/nav";
import { X, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { LanguageSwitcher } from "@/components/website/layout/LanguageSwitcher";
import { useAuth } from "@/lib/website/auth-context";

type Item = { to: string; label: { en: string; fr: string }; search?: Record<string, unknown> };
type Group = { heading: { en: string; fr: string }; items: Item[] };

const GROUPS: Group[] = [
  {
    heading: { en: "Discover", fr: "Découvrir" },
    items: [
      { to: "/marketplace", label: { en: "Marketplace", fr: "Place de marché" } },
      { to: "/deals", label: { en: "Deals", fr: "Offres" } },
      { to: "/pricing", label: { en: "Pricing", fr: "Tarifs" } },
      {
        to: "/marketplace/search",
        label: { en: "Trending", fr: "Tendances" },
        search: { q: "", category: "", sort: "recommended", group: "trending" },
      },
    ],
  },
  {
    heading: { en: "Build", fr: "Construire" },
    items: [
      { to: "/services/websites", label: { en: "Websites", fr: "Sites web" } },
      { to: "/services/mobile-apps", label: { en: "Mobile apps", fr: "Applications mobiles" } },
      { to: "/services/logo-branding", label: { en: "Branding", fr: "Image de marque" } },
      { to: "/services/menu-flyer-design", label: { en: "Menu & flyer design", fr: "Menus et dépliants" } },
    ],
  },
  {
    heading: { en: "Grow", fr: "Croître" },
    items: [
      { to: "/services/marketing", label: { en: "Marketing", fr: "Marketing" } },
      { to: "/services/social-media", label: { en: "Social media", fr: "Réseaux sociaux" } },
      { to: "/services/local-listings", label: { en: "Local visibility", fr: "Visibilité locale" } },
      { to: "/services/lead-generation", label: { en: "Lead generation", fr: "Génération de prospects" } },
    ],
  },
  {
    heading: { en: "Operate", fr: "Opérer" },
    items: [
      { to: "/domain", label: { en: "Domains", fr: "Domaines" } },
      { to: "/hosting", label: { en: "Hosting", fr: "Hébergement" } },
      { to: "/services/voip", label: { en: "VoIP", fr: "Téléphonie VoIP" } },
      { to: "/services/automation", label: { en: "Automation", fr: "Automatisation" } },
      { to: "/services/ai-business-tools", label: { en: "AI business tools", fr: "Outils IA d'affaires" } },
      { to: "/services/data-admin", label: { en: "Data & admin", fr: "Données et administration" } },
    ],
  },
  {
    heading: { en: "Company", fr: "Entreprise" },
    items: [
      { to: "/services", label: { en: "How TAKATAK works", fr: "Comment TAKATAK fonctionne" } },
      { to: "/dashboard/support", label: { en: "Support", fr: "Soutien" } },
      { to: "/marketplace/post-project", label: { en: "Start a project", fr: "Démarrer un projet" } },
      { to: "/dashboard/freelancer", label: { en: "Partner / freelancer", fr: "Partenaire / pigiste" } },
    ],
  },
];

/**
 * Premium site navigation drawer. Closed by default; opens only on an
 * explicit click of the header Menu button.
 */
export function SiteMenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tx } = useLanguage();
  const { isAuthenticated } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),select,input,[tabindex]:not([tabindex="-1"])',
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("button,a")?.focus();
    }, 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(id);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={tx({ en: "Site navigation", fr: "Navigation du site" })}
        className="tk-menu-in absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-border bg-popover shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {tx({ en: "Menu", fr: "Menu" })}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={tx({ en: "Close menu", fr: "Fermer le menu" })}
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {GROUPS.map((group, gi) => (
            <div
              key={group.heading.en}
              className="tk-menu-group mb-6 last:mb-0"
              style={{ animationDelay: `${60 + gi * 45}ms` }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">
                {tx(group.heading)}
              </p>
              <div className="mt-2 space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={`${item.to}-${item.label.en}`}
                    to={item.to as never}
                    search={item.search as never}
                    onClick={onClose}
                    className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[15px] text-foreground/85 transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <span className="min-w-0 truncate">{tx(item.label)}</span>
                    <ArrowRight
                      size={14}
                      aria-hidden
                      className="shrink-0 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-5 py-4">
          <LanguageSwitcher />
          <div className="mt-3 flex gap-2">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                onClick={onClose}
                className="flex-1 rounded-md border border-border px-3 py-2 text-center text-sm font-medium"
              >
                {tx({ en: "Dashboard", fr: "Tableau de bord" })}
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={onClose}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-center text-sm font-medium"
                >
                  {tx({ en: "Sign in", fr: "Connexion" })}
                </Link>
                <Link
                  to="/register"
                  onClick={onClose}
                  className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground"
                >
                  {tx({ en: "Get started", fr: "Commencer" })}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
