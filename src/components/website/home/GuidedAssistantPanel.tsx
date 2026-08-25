"use client";

import { Link } from "@/lib/website/nav";
import { ArrowRight, Headset, FileText, Target } from "lucide-react";
import { openLiveChat } from "@/lib/website/chat-provider";
import { intentLabel, type IntentMatch } from "@/lib/website/service-intent";
import { useLanguage } from "@/lib/website/use-language";

interface Props {
  query: string;
  match: IntentMatch;
  onDismiss: () => void;
}

/** Shown after an AI/voice search so the user sees where they are going
 *  before navigating. No auto-redirect. */
export function GuidedAssistantPanel({ query, match, onDismiss }: Props) {
  const { t, lang } = useLanguage();
  const label = intentLabel(match, lang);
  return (
    <div
      role="status"
      className="mt-3 rounded-2xl border border-primary/30 bg-card/95 p-4 text-left shadow-[var(--shadow-card)] backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Target size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("assistant.bestMatch")}
          </p>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {t("assistant.next", { label: label.toLowerCase(), query })}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t("assistant.dismiss")}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={match.to as never}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          {t("assistant.open")} <ArrowRight size={13} />
        </Link>
        <button
          type="button"
          onClick={() =>
            openLiveChat({
              query,
              intent: match.label,
              page: typeof location !== "undefined" ? location.pathname : undefined,
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:border-primary/45"
        >
          <Headset size={13} /> {t("assistant.support")}
        </button>
        <Link
          to="/marketplace/post-project"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:border-primary/45"
        >
          <FileText size={13} /> {t("assistant.quote")}
        </Link>
      </div>
    </div>
  );
}