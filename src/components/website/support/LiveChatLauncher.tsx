"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/website/nav";
import { Headset, Mail, MessageSquare, X } from "lucide-react";
import { getLiveChatConfig, SUPPORT_EMAIL } from "@/lib/website/live-chat-config";
import { loadLiveChat, openLiveChat, TAKATAK_CHAT_EVENT } from "@/lib/website/chat-provider";
import { useLanguage } from "@/lib/website/use-language";

/**
 * TAKATAK support launcher. When an external provider is configured through
 * VITE_LIVE_CHAT_PROVIDER (+ its key), that widget is loaded once and this
 * bubble stays hidden. Otherwise the built-in support panel is used.
 */
export function LiveChatLauncher() {
  const [external, setExternal] = useState(false);
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<string | null>(null);
  const { t, lang } = useLanguage();

  useEffect(() => {
    const cfg = getLiveChatConfig();
    setExternal(cfg.external);
    if (cfg.external) loadLiveChat();

    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message?: string } | undefined;
      setContext(detail?.message ?? null);
      setOpen(true);
    };
    window.addEventListener(TAKATAK_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(TAKATAK_CHAT_EVENT, onOpen);
  }, []);

  if (external && !open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 print:hidden">
      {open && (
        <div
          role="dialog"
          aria-label={t("chat.title")}
          className="mb-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_70px_-30px_rgba(0,0,0,0.55)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><Headset size={16} /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{t("chat.title")}</p>
                <p className="text-[11px] text-muted-foreground">{t("chat.hours")}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label={t("chat.close")} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3 p-4">
            {context && (
              <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                {context}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {t("chat.intro")}
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("chat.subject"))}&body=${encodeURIComponent(context ?? "")}`}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Mail size={15} /> {t("chat.email")}
            </a>
            <Link
              to="/marketplace/post-project"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-foreground hover:border-primary/45"
            >
              <MessageSquare size={15} /> {t("chat.quote")}
            </Link>
          </div>
        </div>
      )}

      {!external && (
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openLiveChat({ page: typeof location !== "undefined" ? location.pathname : undefined, lang }))}
          aria-label={open ? t("chat.close") : t("chat.launcher")}
          className="ml-auto flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)] transition-transform hover:scale-[1.03]"
        >
          <Headset size={16} /> <span className="hidden sm:inline">{t("home.hero.ctaChat")}</span>
        </button>
      )}
    </div>
  );
}