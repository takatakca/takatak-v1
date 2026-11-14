"use client";

import { useId, useRef, useSyncExternalStore } from "react";
import { Columns3, Inbox, LayoutGrid, List, Menu } from "lucide-react";

const STORAGE_KEY = "takatak.review.layout.v1";
const CHANGE_EVENT = "revew:layout-change";
export const REVIEW_LAYOUTS = [
  {
    id: "inbox",
    label: "Inbox",
    description: "Review list beside one response workspace",
    icon: Inbox,
  },
  {
    id: "list",
    label: "List",
    description: "Compact rows for quick scanning",
    icon: List,
  },
  {
    id: "grid",
    label: "Grid",
    description: "Customer stories in a card gallery",
    icon: LayoutGrid,
  },
  {
    id: "platforms",
    label: "Platforms",
    description: "Separate columns for each review source",
    icon: Columns3,
  },
] as const;
export type ReviewLayout = (typeof REVIEW_LAYOUTS)[number]["id"];
let sessionLayout: ReviewLayout | null = null;

function isLayout(value: string | null): value is ReviewLayout {
  return REVIEW_LAYOUTS.some((layout) => layout.id === value);
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      sessionLayout = null;
      listener();
    }
  };
  window.addEventListener("storage", storage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}
function snapshot(): ReviewLayout {
  if (sessionLayout) return sessionLayout;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLayout(stored) ? stored : "inbox";
  } catch {
    return "inbox";
  }
}
export function useReviewLayout() {
  const layout = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "inbox" as const,
  );
  function setLayout(next: ReviewLayout) {
    sessionLayout = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Private browsing may make storage unavailable; this session still works. */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return [layout, setLayout] as const;
}

/** A native disclosure and radio group: no simulated menu keyboard behavior. */
export function ReviewLayoutPicker({
  layout,
  onChange,
}: {
  layout: ReviewLayout;
  onChange: (layout: ReviewLayout) => void;
}) {
  const groupId = useId();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const selected = REVIEW_LAYOUTS.find((option) => option.id === layout)!;
  return (
    <details
      ref={disclosure}
      className="relative ml-auto shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          disclosure.current?.removeAttribute("open");
          disclosure.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
        <Menu aria-hidden className="h-4 w-4" /> Layout: {selected.label}
      </summary>
      <fieldset className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-1 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
        <legend className="sr-only">Review layout</legend>
        <p className="px-2 pb-2 text-xs font-semibold text-slate-900">
          Choose your review workspace
        </p>
        {REVIEW_LAYOUTS.map(({ id, label, description, icon: Icon }) => (
          <label
            key={id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg p-3 ${layout === id ? "bg-blue-50 text-[#1565D8]" : "text-slate-700 hover:bg-slate-50"}`}
          >
            <input
              type="radio"
              aria-label={label}
              aria-describedby={`${groupId}-${id}-description`}
              name={groupId}
              value={id}
              checked={layout === id}
              onChange={() => onChange(id)}
              className="mt-1 accent-[#1565D8]"
            />
            <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="block text-xs font-semibold">{label}</span>
              <span
                id={`${groupId}-${id}-description`}
                className="mt-1 block text-[11px] leading-5 text-slate-600"
              >
                {description}
              </span>
            </span>
          </label>
        ))}
        <p className="px-2 pt-2 text-[11px] leading-5 text-slate-500">
          The layout changes the presentation. Your filters, source records and
          permissions stay the same.
        </p>
      </fieldset>
    </details>
  );
}
