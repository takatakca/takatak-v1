"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Inbox, Send, Upload, PlugZap } from "lucide-react";

const SECTIONS = [
  { id: "inbox", hash: "review-inbox", label: "Inbox", icon: Inbox },
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

function sectionFromHash(hash: string): SectionId | undefined {
  if (hash === "#first-party-feedback") return "requests";
  return SECTIONS.find((section) => `#${section.hash}` === hash)?.id;
}
function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  window.addEventListener("revew:navigate", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener("revew:navigate", listener);
  };
}

/** Panels remain mounted so navigation preserves review filters and unsent form edits. */
export function ReviewWorkspaceNavigation({
  inbox,
  requests,
  imports,
  connections,
  initialSection = "inbox",
}: {
  inbox: ReactNode;
  requests: ReactNode;
  imports: ReactNode;
  connections: ReactNode;
  initialSection?: SectionId;
}) {
  const active = useSyncExternalStore(
    subscribe,
    () => sectionFromHash(window.location.hash) || initialSection,
    () => initialSection,
  );
  useEffect(() => {
    const hash = window.location.hash;
    if (!sectionFromHash(hash)) return;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ block: "start" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [active]);
  const content = { inbox, requests, import: imports, connections };
  return (
    <div className="space-y-5">
      <nav
        aria-label="Review workspace"
        className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
      >
        <div
          role="group"
          aria-label="Review workspace sections"
          className="grid grid-cols-2 gap-2 lg:grid-cols-4"
        >
          {SECTIONS.map((section) => (
            <button
              type="button"
              key={section.id}
              aria-pressed={active === section.id}
              aria-controls={section.hash}
              onClick={() => {
                if (window.location.hash !== `#${section.hash}`)
                  window.history.pushState(null, "", `#${section.hash}`);
                window.dispatchEvent(new Event("revew:navigate"));
              }}
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
