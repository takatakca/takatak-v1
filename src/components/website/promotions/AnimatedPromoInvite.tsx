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

/** Pages where visitors are filling in a form: the invite never interrupts them. */
const FORM_PAGES = ["/signup", "/register", "/login", "/otp", "/checkout", "/dashboard", "/marketplace/post-project", "/privacy-manager"];

function isTyping(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
}

/**
 * Animated new-client invite. Appears once per visitor after 10s or 35% scroll
 * (never over a form being filled in), captures an email and hands off to
 * signup with the FIRST10 intent preserved. Compact on small screens.
 */
export function AnimatedPromoInvite() {
  const { t } = useLanguage();
  const nav = useNavigate();
  const { isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const armed = useRef(false);

  const suppressed = isAuthenticated || FORM_PAGES.some((page) => pathname.startsWith(page));

  useEffect(() => {
    if (suppressed || armed.current) return;
    if (alreadySeen()) return;
    const state = getPromoState();
    if (state.status === "claimed" || state.status === "used") return;

    armed.current = true;
    let done = false;
    let retry: number | undefined;
    const show = () => {
      if (done) return;
      // Someone typing in a field is busy: try again a little later.
      if (isTyping()) {
        window.clearTimeout(retry);
        retry = window.setTimeout(show, 8_000);
        return;
      }
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
      window.clearTimeout(retry);
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-20 sm:justify-start sm:px-4 sm:pb-6 sm:pl-6">
      <div className="tk-rise-in pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-[var(--shadow-glow)]">
        <div className="relative p-4 sm:p-5">
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
          <h2 className="mt-2 pr-8 text-base font-bold leading-6 text-foreground sm:mt-3 sm:text-lg">{t("promo.invite.title")}</h2>
          <p className="mt-1.5 hidden text-sm leading-6 text-muted-foreground sm:block">{t("promo.invite.subtitle")}</p>

          <form onSubmit={submit} className="mt-3 flex flex-row gap-2 sm:mt-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("promo.invite.placeholder")}
              aria-label={t("promo.invite.placeholder")}
              className="hidden min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary sm:block"
            />
            <button
              type="submit"
              className="inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:flex-none"
            >
              {t("promo.invite.cta")} <ArrowRight size={14} />
            </button>
          </form>

          <p className="mt-2 text-[11px] leading-4 text-muted-foreground sm:mt-3">{t("promo.invite.legal")}</p>
        </div>
      </div>
    </div>
  );
}
