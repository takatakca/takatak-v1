"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import {
  Gift,
  X,
} from "lucide-react";

import {
  dismissStickyPromo,
  getPromoState,
  isStickyPromoDismissed,
  savePendingPromo,
  trackPromo,
} from "@/lib/website/promotions";

export function PromoStickyCard() {
  const pathname = usePathname();

  const [show, setShow] =
    useState(false);

  useEffect(() => {
    if (isStickyPromoDismissed()) {
      return;
    }

    const state = getPromoState();

    if (
      state.status === "claimed" ||
      state.status === "used"
    ) {
      return;
    }

    let tracked = false;

    function onScroll(): void {
      if (window.scrollY <= 600) {
        return;
      }

      setShow(true);

      if (!tracked) {
        tracked = true;

        trackPromo(
          "promo_banner_viewed",
          {
            surface: "sticky_card",
          },
        );
      }

      window.removeEventListener(
        "scroll",
        onScroll,
      );
    }

    window.addEventListener(
      "scroll",
      onScroll,
      {
        passive: true,
      },
    );

    return () => {
      window.removeEventListener(
        "scroll",
        onScroll,
      );
    };
  }, []);

  const allowed =
    pathname === "/" ||
    pathname.startsWith(
      "/marketplace",
    );

  if (!show || !allowed) {
    return null;
  }

  function dismiss(): void {
    dismissStickyPromo();
    setShow(false);
  }

  return (
    <aside
      aria-label="First service offer"
      className="fixed bottom-3 left-3 right-3 z-[110] rounded-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-[0_24px_80px_-20px_rgba(15,23,42,0.45)] sm:bottom-5 sm:left-auto sm:right-5 sm:w-[360px]"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-950"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3 pr-7">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Gift size={18} />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">
            New client offer
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-600">
            Create an account and your 10%
            first-service credit is saved in your
            TAKATAK dashboard.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href="/register?promo=FIRST10"
          onClick={() => {
            savePendingPromo();

            trackPromo(
              "promo_banner_clicked",
              {
                surface:
                  "sticky_card",
              },
            );
          }}
          className="flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-emerald-500"
        >
          Create account and claim 10%
        </Link>

        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
        >
          Not now
        </button>
      </div>
    </aside>
  );
}