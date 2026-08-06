"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import {
  Sparkles,
  X,
} from "lucide-react";

import {
  dismissPromoBar,
  getPromoState,
  isPromoBarDismissed,
  savePendingPromo,
  trackPromo,
} from "@/lib/website/promotions";

export function PromoTopBar() {
  const pathname = usePathname();

  const [hidden, setHidden] =
    useState(true);

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        if (
          isPromoBarDismissed()
        ) {
          return;
        }

        const state =
          getPromoState();

        if (
          state.status ===
          "used"
        ) {
          return;
        }

        setHidden(false);

        trackPromo(
          "promo_banner_viewed",
          {
            surface: "top_bar",
          },
        );
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, []);

  if (
    hidden ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/checkout") ||
    pathname === "/verification"
  ) {
    return null;
  }

  return (
    <div className="relative z-40 border-b border-white/10 bg-[color:var(--brand-bg,#0b0f17)] text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-[13px]">
        <Sparkles
          size={14}
          className="shrink-0 text-primary"
          aria-hidden="true"
        />

        <p className="flex-1 truncate">
          <span className="font-medium">
            New client offer
          </span>

          <span className="text-white/70">
            {" "}
            — get 10% off your first
            TAKATAK service.
          </span>
        </p>

        <Link
          href="/register?promo=FIRST10"
          onClick={() => {
            savePendingPromo();

            trackPromo(
              "promo_banner_clicked",
              {
                surface: "top_bar",
              },
            );
          }}
          className="hidden items-center rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 sm:inline-flex"
        >
          Claim offer
        </Link>

        <button
          type="button"
          aria-label="Dismiss offer"
          onClick={() => {
            dismissPromoBar();
            setHidden(true);
          }}
          className="ml-1 text-white/60 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}