"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  return name === "AbortError";
}

function isBrowserNetworkError(error: unknown): boolean {
  if (isAbortError(error)) return false;
  if (!(error instanceof Error)) return false;
  return /fetch failed|failed to fetch|networkerror|network request failed|load failed/i.test(
    error.message,
  );
}

/**
 * Global notice when the browser is offline or a request cannot reach the network.
 */
export function NetworkStatusBanner() {
  const [offline, setOffline] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);

  useEffect(() => {
    function syncOnline() {
      setOffline(!window.navigator.onLine);
      if (window.navigator.onLine) {
        setRequestFailed(false);
      }
    }

    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      try {
        const response = await originalFetch(input, init);
        if (response.ok) {
          setRequestFailed(false);
        }
        return response;
      } catch (error) {
        if (isBrowserNetworkError(error)) {
          setRequestFailed(true);
        }
        throw error;
      }
    };

    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.fetch = originalFetch;
    };
  }, []);

  if (!offline && !requestFailed) {
    return null;
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-[200] border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-950 shadow-sm"
    >
      <span className="inline-flex items-center justify-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        Connection problem. Check your network and try again.
        <button
          type="button"
          className="rounded-md bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950 hover:bg-amber-300"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </span>
    </div>
  );
}
