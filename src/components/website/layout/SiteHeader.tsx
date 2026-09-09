"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/website/nav";
import { Menu, MapPin, Target } from "lucide-react";
import { useAuth } from "@/lib/website/auth-context";
import { useLanguage } from "@/lib/website/use-language";
import { LanguageSwitcher } from "@/components/website/layout/LanguageSwitcher";
import { UniversalSearchPanel } from "@/components/website/search/UniversalSearchPanel";
import { HeaderDomainSearch } from "@/components/website/domain/HeaderDomainSearch";
import { HeaderProductExternalLink } from "@/components/website/layout/HeaderProductAction";
import { QMAPS, FLEXS } from "@/lib/website/product-destinations";
import { ProductLauncher } from "@/components/website/layout/ProductLauncher";
import { MarketplaceCategoryRail } from "@/components/website/marketplace/MarketplaceCategoryRail";
import { SiteMenuDrawer } from "@/components/website/layout/SiteMenuDrawer";
import { useExclusiveOverlay } from "@/lib/website/overlay-manager";

/**
 * Header priority: logo, universal search, Find my domain, QMAPS, FLEXS,
 * language, account, Get started, and a Menu button. All other navigation
 * lives inside the drawer, closed until the customer opens it.
 */
export function SiteHeader() {
  const { open: menuOpen, setOpen: setMenuOpen, toggle: toggleMenu } = useExclusiveOverlay("menu");
  const { isAuthenticated, logout } = useAuth();
  const { t, tx } = useLanguage();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <header className="relative sticky top-0 z-50 overflow-visible">
      {/* Blur on a sibling layer so dropdowns are not clipped by backdrop-filter. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 border-b bg-background/80 backdrop-blur-xl transition-all duration-300 supports-[backdrop-filter]:bg-background/70 ${
          scrolled ? "border-border shadow-[0_10px_30px_-24px_rgb(0_0_0/0.6)]" : "border-border/60"
        }`}
      />
      <div className="relative">
      <nav
        className={`mx-auto flex max-w-7xl items-center gap-3 px-4 transition-all duration-300 ${
          scrolled ? "h-14" : "h-16"
        }`}
      >
        <Link to="/" className="flex shrink-0 items-center gap-1.5" aria-label="TAKATAK home">
          <span className="text-[22px] font-extrabold tracking-tight text-foreground">TAKATAK</span>
          <span className="mt-3 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        </Link>

        {/* Priority discovery actions */}
        <div className="hidden min-w-0 flex-1 items-center gap-1.5 md:flex">
          <div className="min-w-[170px] max-w-xl flex-1">
            <UniversalSearchPanel />
          </div>
          <HeaderDomainSearch />
          <span className="hidden xl:contents">
            <HeaderProductExternalLink href={QMAPS.productUrl} label="QMAPS" tooltip={t("nav.qmapsDesc")} icon={MapPin} />
            <HeaderProductExternalLink href={FLEXS.productUrl} label="FLEXS" tooltip={t("nav.flexsDesc")} icon={Target} />
          </span>
          <span className="contents xl:hidden">
            <HeaderProductExternalLink href={QMAPS.productUrl} label="QMAPS" tooltip={t("nav.qmapsDesc")} icon={MapPin} compact />
            <HeaderProductExternalLink href={FLEXS.productUrl} label="FLEXS" tooltip={t("nav.flexsDesc")} icon={Target} compact />
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div className="hidden lg:block">
            <LanguageSwitcher className="mr-1" />
          </div>

          <div className="hidden items-center gap-1 lg:flex">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-medium hover:bg-secondary">
                  {t("nav.dashboard")}
                </Link>
                <button
                  onClick={() => void logout()}
                  className="whitespace-nowrap rounded-md border border-border px-3 py-2 text-[13px] font-medium hover:bg-secondary"
                >
                  {t("nav.signout")}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-medium text-foreground/80 hover:text-foreground">
                  {t("nav.signin")}
                </Link>
                <Link
                  to="/register"
                  className="whitespace-nowrap rounded-md bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {t("nav.getStarted")}
                </Link>
              </>
            )}
          </div>

          <div className="md:hidden">
            <ProductLauncher />
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            onClick={toggleMenu}
            aria-expanded={menuOpen}
            aria-controls="tk-site-menu"
            aria-label={menuOpen ? tx({ en: "Close menu", fr: "Fermer le menu" }) : tx({ en: "Open menu", fr: "Ouvrir le menu" })}
            className="group ml-1 inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card/60 px-2.5 text-[13px] font-semibold text-foreground transition-all hover:border-primary/50 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Menu size={17} className="text-primary transition-transform duration-200 group-hover:scale-110" />
            <span className="hidden lg:inline">{tx({ en: "Menu", fr: "Menu" })}</span>
          </button>
        </div>
      </nav>

      <div className="border-t border-border/60 px-4 py-2 md:hidden">
        <UniversalSearchPanel compact />
      </div>

      <MarketplaceCategoryRail />

      <div id="tk-site-menu">
        <SiteMenuDrawer open={menuOpen} onClose={closeMenu} />
      </div>
      </div>
    </header>
  );
}
