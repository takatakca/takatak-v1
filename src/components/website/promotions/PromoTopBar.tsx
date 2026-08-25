"use client";

import { useRouterState } from "@/lib/website/nav";
import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import {
  dismissPromoBar,
  getPromoState,
  isPromoBarDismissed,
  trackPromo,
} from "@/lib/website/promotions";
import { useLanguage } from "@/lib/website/use-language";
import { WelcomeOfferFlow } from "@/components/website/promotions/WelcomeOfferFlow";

export function PromoTopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hidden, setHidden] = useState(true);
  const [flowOpen, setFlowOpen] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (isPromoBarDismissed()) return;
    const s = getPromoState();
    if (s.status === "used") return;
    setHidden(false);
    trackPromo("promo_banner_viewed", { surface: "top_bar" });
  }, []);

  if (
    hidden ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/checkout") ||
    pathname === "/otp"
  ) {
    return null;
  }

  return (
    <div className="relative z-40 border-b border-white/10 bg-[color:var(--brand-bg,#0b0f17)] text-white">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-[13px]">
        <Sparkles size={14} className="text-primary shrink-0" aria-hidden />
        <p className="flex-1 truncate">
          <span className="font-medium">{t("promo.bar.title")}</span>
          <span className="text-white/70">{t("promo.bar.body")}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            trackPromo("promo_banner_clicked", { surface: "top_bar" });
            setFlowOpen(true);
          }}
          className="hidden sm:inline-flex items-center rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          {t("promo.bar.cta")}
        </button>
        <button
          aria-label={t("promo.bar.dismiss")}
          onClick={() => {
            dismissPromoBar();
            setHidden(true);
          }}
          className="ml-1 text-white/60 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
      {flowOpen && <WelcomeOfferFlow onClose={() => setFlowOpen(false)} />}
    </div>
  );
}