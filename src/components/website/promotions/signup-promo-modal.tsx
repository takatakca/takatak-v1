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
  getPromoState,
  markModalShown,
  savePendingPromo,
  trackPromo,
  wasModalShown,
} from "@/lib/website/promotions";

export function SignupPromoModal() {
  const pathname = usePathname();

  const [open, setOpen] =
    useState(false);

  useEffect(() => {
    if (wasModalShown()) {
      return;
    }

    const state = getPromoState();

    if (
      state.status === "claimed" ||
      state.status === "used"
    ) {
      return;
    }

    if (
      pathname !== "/" &&
      !pathname.startsWith(
        "/marketplace",
      )
    ) {
      return;
    }

    let opened = false;

    function openOnce(
      reason: string,
    ): void {
      if (opened) {
        return;
      }

      opened = true;
      setOpen(true);
      markModalShown();

      trackPromo(
        "signup_promo_viewed",
        {
          reason,
        },
      );
    }

    const timeout =
      window.setTimeout(
        () =>
          openOnce("dwell_20s"),
        20_000,
      );

    function exitHandler(
      event: MouseEvent,
    ): void {
      if (event.clientY <= 0) {
        openOnce("exit_intent");
      }
    }

    document.addEventListener(
      "mouseleave",
      exitHandler,
    );

    return () => {
      window.clearTimeout(timeout);

      document.removeEventListener(
        "mouseleave",
        exitHandler,
      );
    };
  }, [pathname]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-modal-title"
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Close promotion"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={() =>
          setOpen(false)
        }
      />

      <section className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_32px_100px_-25px_rgba(15,23,42,0.7)]">
        <button
          type="button"
          aria-label="Close"
          onClick={() =>
            setOpen(false)
          }
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-950"
        >
          <X size={18} />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Sparkles size={21} />
        </div>

        <h2
          id="promo-modal-title"
          className="mt-5 text-2xl font-bold text-slate-950"
        >
          A new client offer from TAKATAK
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Create your account and your{" "}
          <strong className="text-slate-950">
            10% first-service credit
          </strong>{" "}
          is saved in your dashboard, ready for
          your first eligible order.
        </p>

        <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
          <li>• One discount per new client</li>

          <li>
            • Applies to your first eligible
            TAKATAK service order
          </li>

          <li>
            • Calculated clearly during checkout
          </li>
        </ul>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/register?promo=FIRST10"
            onClick={() => {
              savePendingPromo();

              trackPromo(
                "signup_promo_claimed",
                {
                  surface: "modal",
                },
              );
            }}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Claim 10% off
          </Link>

          <button
            type="button"
            onClick={() =>
              setOpen(false)
            }
            className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Continue browsing
          </button>
        </div>
      </section>
    </div>
  );
}