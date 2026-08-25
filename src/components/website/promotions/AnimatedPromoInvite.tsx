"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@/lib/website/nav";
import { Gift, X, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { useAuth } from "@/lib/website/auth-context";
import { PROMO_CODE, savePendingPromo, trackPromo, getPromoState } from "@/lib/website/promotions";

const SEEN_KEY = "takatak.promo.invite.seen";

function alreadySeen() {
  try {
    return !!localStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Animated new-client invite. Appears once per visitor after 10s or 35% scroll,
 * captures an email and hands off to signup with the FIRST10 intent preserved.
 */
export function AnimatedPromoInvite() {
  const { t } = useLanguage();
  const nav = useNavigate();
  const { isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const armed = useRef(false);

  const suppressed =
    isAuthenticated ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/otp") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/dashboard");

  useEffect(() => {
    if (suppressed || armed.current) return;
    if (alreadySeen()) return;
    const state = getPromoState();
    if (state.status === "claimed" || state.status === "used") return;

    armed.current = true;
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      setOpen(true);
      markSeen();
      trackPromo("promo_banner_viewed", { surface: "invite" });
      window.removeEventListener("scroll", onScroll);
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= 0.35) show();
    };
    const timer = window.setTimeout(show, 10_000);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [suppressed]);

  if (!open || suppressed) return null;

  const close = () => setOpen(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    savePendingPromo();
    trackPromo("promo_banner_clicked", { surface: "invite" });
    setOpen(false);
    void nav({
      to: "/register",
      search: {
        promo: PROMO_CODE,
        next: pathname,
        ...(email.trim() ? { email: email.trim() } : {}),
      } as never,
    });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-24 sm:justify-start sm:pb-6 sm:pl-6">
      <div className="tk-rise-in pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-[var(--shadow-glow)]">
        <div className="relative p-5">
          <button
            type="button"
            onClick={close}
            aria-label={t("promo.invite.dismiss")}
            className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X size={15} />
          </button>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Gift size={12} /> {t("promo.invite.eyebrow")}
          </span>
          <h2 className="mt-3 text-lg font-bold leading-6 text-foreground">{t("promo.invite.title")}</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{t("promo.invite.subtitle")}</p>

          <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("promo.invite.placeholder")}
              aria-label={t("promo.invite.placeholder")}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {t("promo.invite.cta")} <ArrowRight size={14} />
            </button>
          </form>

          <p className="mt-3 text-[11px] leading-4 text-muted-foreground">{t("promo.invite.legal")}</p>
        </div>
      </div>
    </div>
  );
}
