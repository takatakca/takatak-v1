"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Inbox, Send, Upload, PlugZap, ClipboardCheck } from "lucide-react";
import {
  REVIEW_WORKSPACE_EVENT,
  reviewSectionFromHash,
} from "@/lib/reputation/workspace-navigation";

const SECTIONS = [
  { id: "inbox", hash: "review-inbox", label: "Inbox", icon: Inbox },
  {
    id: "approvals",
    hash: "review-approvals",
    label: "Réponses IA",
    icon: ClipboardCheck,
  },
  {
    id: "requests",
    hash: "review-requests",
    label: "Requests & activity",
    icon: Send,
  },
  {
    id: "import",
    hash: "review-import",
    label: "Import reviews",
    icon: Upload,
  },
  {
    id: "connections",
    hash: "review-connections",
    label: "Connections",
    icon: PlugZap,
  },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  window.addEventListener(REVIEW_WORKSPACE_EVENT, listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener(REVIEW_WORKSPACE_EVENT, listener);
  };
}

export function useReviewWorkspaceHash() {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => "");
}

/** Keep mounted inbox/editor state while making exact-run links shareable. */
export function navigateReviewWorkspace(hash: string) {
  if (!reviewSectionFromHash(hash)) return;
  if (window.location.hash !== hash)
    window.history.pushState(null, "", hash);
  window.dispatchEvent(new Event(REVIEW_WORKSPACE_EVENT));
}

/** Panels remain mounted so navigation preserves review filters and unsent form edits. */
export function ReviewWorkspaceNavigation({
  inbox,
  requests,
  approvals,
  imports,
  connections,
  initialSection = "inbox",
}: {
  inbox: ReactNode;
  requests: ReactNode;
  approvals: ReactNode;
  imports: ReactNode;
  connections: ReactNode;
  initialSection?: SectionId;
}) {
  const hash = useReviewWorkspaceHash();
  const active = reviewSectionFromHash(hash) || initialSection;
  useEffect(() => {
    if (!reviewSectionFromHash(hash)) return;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById(hash.split("?", 1)[0].slice(1))
        ?.scrollIntoView({ block: "start" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [active, hash]);
  const content = { inbox, approvals, requests, import: imports, connections };
  return (
    <div className="space-y-5">
      <nav
        aria-label="Review workspace"
        className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
      >
        <div
          role="group"
          aria-label="Review workspace sections"
          className="grid grid-cols-2 gap-2 lg:grid-cols-5"
        >
          {SECTIONS.map((section) => (
            <button
              type="button"
              key={section.id}
              aria-pressed={active === section.id}
              aria-controls={section.hash}
              onClick={() => navigateReviewWorkspace(`#${section.hash}`)}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:text-sm ${active === section.id ? "bg-[#1565D8] text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <section.icon aria-hidden className="h-4 w-4 shrink-0" />
              {section.label}
            </button>
          ))}
        </div>
      </nav>
      {SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.hash}
          aria-label={section.label}
          hidden={active !== section.id}
          className="scroll-mt-24 space-y-5"
        >
          {content[section.id]}
        </section>
      ))}
    </div>
  );
}
