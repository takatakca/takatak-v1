"use client";

import { Link, useRouterState } from "@/lib/website/nav";
import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import {
  getPromoState,
  markModalShown,
  trackPromo,
  wasModalShown,
} from "@/lib/website/promotions";

export function SignupPromoModal() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (wasModalShown()) return;
    const s = getPromoState();
    if (s.status === "claimed" || s.status === "used") return;
    if (pathname !== "/" && !pathname.startsWith("/marketplace")) return;

    let opened = false;
    const openOnce = (reason: string) => {
      if (opened) return;
      opened = true;
      setOpen(true);
      markModalShown();
      trackPromo("signup_promo_viewed", { reason });
    };

    const t = window.setTimeout(() => openOnce("dwell_20s"), 20_000);
    const exitHandler = (e: MouseEvent) => {
      if (e.clientY <= 0) openOnce("exit_intent");
    };
    document.addEventListener("mouseleave", exitHandler);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mouseleave", exitHandler);
    };
  }, [pathname]);

  if (!open) return null;
  const close = () => setOpen(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-black/60" onClick={close} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <button
          aria-label="Close"
          onClick={close}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles size={20} />
        </div>
        <h2 id="promo-modal-title" className="mt-4 text-xl font-semibold text-foreground">
          A new client offer from TAKATAK
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your account and your <span className="font-semibold text-foreground">10% first-service credit</span> is saved in your dashboard, ready for your first eligible order.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-foreground/90">
          <li>• One discount per new client</li>
          <li>• Applies to your first eligible TAKATAK service order</li>
          <li>• Calculated at checkout — no fine print on totals</li>
        </ul>
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <Link
            to="/register"
            search={{ promo: "FIRST10" } as never}
            onClick={() => trackPromo("signup_promo_claimed", { surface: "modal" })}
            className="flex-1 text-center px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
          >
            Claim 10% off
          </Link>
          <button
            onClick={close}
            className="px-4 py-2.5 rounded-md border border-border text-sm font-medium text-foreground hover:bg-muted/40"
          >
            Continue browsing
          </button>
        </div>
      </div>
    </div>
  );
}