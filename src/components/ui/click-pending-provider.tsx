"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const CLICKABLE_SELECTOR =
  "a[href], button, input[type=submit], input[type=button], input[type=image], [role=button]";

const OVERLAY_DELAY_MS = 160;
const ENROLL_FETCH_MS = 600;
const IDLE_FINISH_MS = 140;
const NAV_FALLBACK_MS = 400;
const MAX_PENDING_MS = 20_000;

function headerValue(headers: Headers, name: string): string | null {
  return headers.get(name) ?? headers.get(name.toLowerCase());
}

function requestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const headers = new Headers();
  if (input instanceof Request) {
    input.headers.forEach((value, key) => headers.set(key, value));
  }
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

function isPrefetchRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const prefetch = headerValue(requestHeaders(input, init), "Next-Router-Prefetch");
  return prefetch != null && prefetch !== "false";
}

function findClickable(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(CLICKABLE_SELECTOR);
}

function isDisabled(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled")) return true;
  if (el.getAttribute("aria-disabled") === "true") return true;
  if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
    return el.disabled;
  }
  return false;
}

function isUiToggle(el: HTMLElement): boolean {
  if (el.closest("[data-no-pending]") || el.dataset.noPending === "true") return true;
  if (el.hasAttribute("aria-expanded")) return true;
  if (el.hasAttribute("aria-haspopup")) return true;
  if (el.hasAttribute("aria-pressed")) return true;
  const role = el.getAttribute("role");
  if (
    role === "tab" ||
    role === "switch" ||
    role === "checkbox" ||
    role === "radio" ||
    role === "menuitem" ||
    role === "option"
  ) {
    return true;
  }
  if (el.closest("[role='menu'], [role='tablist'], [role='listbox'], [role='combobox']")) {
    return true;
  }
  if (el.closest("[aria-roledescription='carousel']")) return true;
  const type = (el.getAttribute("type") || "").toLowerCase();
  if (type === "reset") return true;
  return false;
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isInternalNavigation(anchor: HTMLAnchorElement): boolean {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const raw = anchor.getAttribute("href");
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

function shouldTrack(el: HTMLElement): "navigation" | "submit" | "action" | null {
  if (isDisabled(el)) return null;
  if (el instanceof HTMLAnchorElement) {
    return isInternalNavigation(el) ? "navigation" : null;
  }
  if (isUiToggle(el)) return null;
  const type = (el.getAttribute("type") || (el.tagName === "BUTTON" ? "submit" : "button")).toLowerCase();
  if (type === "submit" || type === "image") return "submit";
  if (el.tagName === "BUTTON" || el.tagName === "INPUT" || el.getAttribute("role") === "button") {
    return "action";
  }
  return null;
}

function markBusy(el: HTMLElement) {
  el.setAttribute("data-click-pending", "true");
  el.setAttribute("aria-busy", "true");
}

function unmarkBusy(el: HTMLElement | null) {
  if (!el) return;
  el.removeAttribute("data-click-pending");
  el.removeAttribute("aria-busy");
}

function ClickPendingRouteSync({ onRoute }: { onRoute: (key: string) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    onRoute(key);
  }, [key, onRoute]);

  return null;
}

export function ClickPendingProvider({ children }: { children: ReactNode }) {
  const [showOverlay, setShowOverlay] = useState(false);
  const pendingRef = useRef(false);
  const pendingElRef = useRef<HTMLElement | null>(null);
  const generationRef = useRef(0);
  const restoreFetchRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<number[]>([]);
  const showOverlayRef = useRef(false);
  const startPendingRef = useRef<(el: HTMLElement, kind: "navigation" | "submit" | "action") => void>(
    () => undefined,
  );

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const finish = useCallback(() => {
    generationRef.current += 1;
    pendingRef.current = false;
    unmarkBusy(pendingElRef.current);
    pendingElRef.current = null;
    restoreFetchRef.current?.();
    restoreFetchRef.current = null;
    clearTimers();
    setShowOverlay(false);
  }, [clearTimers]);

  const onRoute = useCallback(
    (_key: string) => {
      if (pendingRef.current) finish();
    },
    [finish],
  );

  const startPending = useCallback(
    (el: HTMLElement, kind: "navigation" | "submit" | "action") => {
      restoreFetchRef.current?.();
      restoreFetchRef.current = null;
      clearTimers();

      const generation = generationRef.current + 1;
      generationRef.current = generation;
      pendingRef.current = true;
      pendingElRef.current = el;
      markBusy(el);

      const tracked = new Set<Promise<unknown>>();

      const originalFetch = window.fetch.bind(window);
      window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const result = originalFetch(input, init);
        if (generationRef.current !== generation) return result;
        if (isPrefetchRequest(input, init)) return result;
        tracked.add(result);
        void result.finally(() => {
          tracked.delete(result);
        });
        return result;
      }) as typeof fetch;
      restoreFetchRef.current = () => {
        window.fetch = originalFetch;
      };

      timersRef.current.push(
        window.setTimeout(() => {
          if (generationRef.current === generation) setShowOverlay(true);
        }, OVERLAY_DELAY_MS),
      );

      timersRef.current.push(
        window.setTimeout(() => {
          if (generationRef.current === generation) finish();
        }, MAX_PENDING_MS),
      );

      const settle = () => {
        if (generationRef.current !== generation) return;

        const waitUntilIdle = async () => {
          const hadWork = tracked.size > 0;
          while (tracked.size > 0) {
            await Promise.allSettled([...tracked]);
          }
          if (hadWork) {
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            });
          }
          if (generationRef.current !== generation) return;
          if (kind === "navigation") {
            timersRef.current.push(
              window.setTimeout(() => {
                if (generationRef.current === generation) finish();
              }, NAV_FALLBACK_MS),
            );
            return;
          }
          finish();
        };

        void waitUntilIdle();
      };

      const enrollMs = kind === "action" ? IDLE_FINISH_MS : ENROLL_FETCH_MS;
      timersRef.current.push(window.setTimeout(settle, enrollMs));
    },
    [clearTimers, finish],
  );

  useLayoutEffect(() => {
    showOverlayRef.current = showOverlay;
    startPendingRef.current = startPending;
  }, [showOverlay, startPending]);

  useEffect(() => {
    const belongsToPending = (el: HTMLElement | null) => {
      const pendingEl = pendingElRef.current;
      if (!pendingEl || !el) return false;
      return pendingEl === el || pendingEl.contains(el) || el.contains(pendingEl);
    };

    const blockIfBusy = (event: Event, el: HTMLElement | null) => {
      if (!pendingRef.current) return false;
      if (showOverlayRef.current || belongsToPending(el)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
      return false;
    };

    const onClickCapture = (event: MouseEvent) => {
      const el = findClickable(event.target);
      if (blockIfBusy(event, el)) return;
      if (!el || isModifiedClick(event) || event.defaultPrevented) return;
      const kind = shouldTrack(el);
      if (!kind) return;
      startPendingRef.current(el, kind);
    };

    const onSubmitCapture = (event: SubmitEvent) => {
      const submitter =
        (event.submitter instanceof HTMLElement ? event.submitter : null) ??
        (event.target instanceof HTMLElement ? event.target : null);
      if (pendingRef.current) {
        if (belongsToPending(submitter)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!submitter || isDisabled(submitter) || submitter.closest("[data-no-pending]")) return;
      startPendingRef.current(submitter, "submit");
    };

    const onKeyDownCapture = (event: KeyboardEvent) => {
      if (!pendingRef.current || !showOverlayRef.current) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("submit", onSubmitCapture, true);
    document.addEventListener("keydown", onKeyDownCapture, true);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("submit", onSubmitCapture, true);
      document.removeEventListener("keydown", onKeyDownCapture, true);
      restoreFetchRef.current?.();
      restoreFetchRef.current = null;
      clearTimers();
      pendingRef.current = false;
    };
  }, [clearTimers]);

  return (
    <>
      <Suspense fallback={null}>
        <ClickPendingRouteSync onRoute={onRoute} />
      </Suspense>
      <div
        className="flex min-h-full flex-1 flex-col"
        aria-busy={showOverlay || undefined}
        inert={showOverlay || undefined}
      >
        {children}
      </div>
      {showOverlay ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/30 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-label="Loading"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-xl">
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-slate-700">Loading…</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
