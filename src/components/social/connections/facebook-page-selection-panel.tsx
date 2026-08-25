"use client";

import { Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type FacebookPageOption = {
  /** Internal Takatak account row id — used for selection validation, never a Facebook Page ID. */
  socialAccountId: string;
  name: string;
  category: string | null;
  profileImageUrl: string | null;
  selectable: boolean;
  connectionEligible?: boolean;
  fullyManageable?: boolean;
  capabilityClass?: string;
  canReadEngagement?: boolean;
  canPublish?: boolean;
  canModerate?: boolean;
  limitationLabel?: string | null;
  unavailableReason:
    | "already_connected"
    | "insufficient_access"
    | null;
  /** Persisted selected Page for this connection (display only; save still requires confirm). */
  isCurrentSelection?: boolean;
};

type DiscoveryResponse = {
  ok?: boolean;
  message?: string;
  category?: string;
  discovery?: {
    connectionId: string;
    connectionStatus: string;
    empty: boolean;
    pages: FacebookPageOption[];
  };
};

type SelectResponse = {
  ok?: boolean;
  message?: string;
  category?: string;
  selection?: {
    pageName?: string;
    profileImageUrl?: string | null;
    socialAccountId?: string;
    connectionStatus?: string;
  };
};

export type FacebookPageConnectedSelection = {
  pageName: string;
  socialAccountId: string | null;
  profileImageUrl: string | null;
};

type PanelState =
  | "loading"
  | "ready"
  | "empty"
  | "permission_required"
  | "authorization_expired"
  | "rate_limited"
  | "temporary"
  | "malformed"
  | "selecting"
  | "error";

function categoryToState(
  category: string | undefined,
): PanelState {
  switch (category) {
    case "empty":
      return "empty";
    case "permission_required":
      return "permission_required";
    case "authorization_expired":
      return "authorization_expired";
    case "rate_limited":
      return "rate_limited";
    case "malformed":
      return "malformed";
    case "temporary":
      return "temporary";
    case "not_found":
    case "conflict":
    case "forbidden":
    case "unavailable":
      // Select/API categories — keep the panel interactive; copy comes from the API.
      return "error";
    default:
      return "temporary";
  }
}

function stateMessage(
  state: PanelState,
  fallback: string,
): string {
  const trimmed = fallback.trim();
  switch (state) {
    case "empty":
      return (
        trimmed ||
        "No manageable Facebook Pages were found for this authorization."
      );
    case "permission_required":
      return (
        trimmed ||
        "Facebook Page permissions are missing. Reauthorize with Page access, then try again."
      );
    case "authorization_expired":
      return (
        trimmed ||
        "Facebook authorization expired. Reconnect to continue setup."
      );
    case "rate_limited":
      return (
        trimmed ||
        "Facebook rate-limited Page discovery. Wait a moment and retry."
      );
    case "malformed":
      return (
        trimmed ||
        "Facebook returned an incomplete Page list. You can retry."
      );
    case "temporary":
      return (
        trimmed ||
        "Facebook Page discovery failed temporarily. You can retry."
      );
    case "error":
      return (
        trimmed ||
        "The Facebook Page could not be selected. You can retry."
      );
    default:
      return (
        trimmed ||
        "Facebook Pages could not be loaded."
      );
  }
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

export function FacebookPageSelectionPanel({
  connectionId,
  onClose,
  onConnected,
}: {
  connectionId: string;
  onClose: () => void;
  onConnected: (selection: FacebookPageConnectedSelection) => void;
}) {
  const [state, setState] = useState<PanelState>("loading");
  const [message, setMessage] = useState(
    "Loading Facebook Pages…",
  );
  const [pages, setPages] = useState<FacebookPageOption[]>(
    [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const loadGenerationRef = useRef(0);
  const inFlightRef = useRef(false);

  async function loadPages() {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    const generation = ++loadGenerationRef.current;
    setBusy(true);
    setState("loading");
    setMessage("Loading Facebook Pages…");
    setSelectedId(null);

    try {
      const response = await fetch(
        `/api/social/connections/${connectionId}/pages`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );

      if (generation !== loadGenerationRef.current) {
        return;
      }

      const body = await readJson<DiscoveryResponse>(response);

      if (!response.ok || !body.ok || !body.discovery) {
        const next = categoryToState(body.category);
        setState(next);
        setMessage(
          stateMessage(
            next,
            body.message ??
              "Facebook Pages could not be loaded.",
          ),
        );
        setPages([]);
        return;
      }

      if (body.discovery.empty || body.discovery.pages.length === 0) {
        setState("empty");
        setMessage(stateMessage("empty", body.message ?? ""));
        setPages([]);
        return;
      }

      setPages(body.discovery.pages);
      const current = body.discovery.pages.find(
        (page) => page.isCurrentSelection,
      );
      // Show the persisted Page as the current choice; do not save until confirm.
      setSelectedId(current?.socialAccountId ?? null);
      setState("ready");
      setMessage(
        "Choose the Facebook Page to connect to this brand.",
      );
    } catch {
      if (generation !== loadGenerationRef.current) {
        return;
      }
      setState("temporary");
      setMessage(stateMessage("temporary", ""));
      setPages([]);
    } finally {
      if (generation === loadGenerationRef.current) {
        setBusy(false);
      }
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    void loadPages();
    return () => {
      loadGenerationRef.current += 1;
      inFlightRef.current = false;
    };
    // Load once when the panel opens for this connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  async function confirmSelection() {
    if (!selectedId || busy) {
      return;
    }

    setBusy(true);
    setState("selecting");
    setMessage("Connecting the selected Facebook Page…");

    try {
      const response = await fetch(
        `/api/social/connections/${connectionId}/pages/select`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            socialAccountId: selectedId,
          }),
        },
      );

      const body = await readJson<SelectResponse>(response);

      if (!response.ok || !body.ok) {
        const next = categoryToState(body.category);
        // Keep the discovered list so the user can pick again.
        // Do not recycle discovery-failure copy for select errors.
        const selectFailed =
          next === "error" ||
          next === "temporary" ||
          next === "malformed" ||
          next === "rate_limited" ||
          next === "permission_required" ||
          next === "authorization_expired";

        if (selectFailed && pages.length > 0) {
          setState("ready");
          setMessage(
            body.message?.trim() ||
              stateMessage(
                next === "temporary" ? "error" : next,
                "The Facebook Page could not be selected. You can retry.",
              ),
          );
          return;
        }

        setState(next === "empty" ? "temporary" : next);
        setMessage(
          stateMessage(
            next,
            body.message ??
              "The Facebook Page could not be selected.",
          ),
        );
        return;
      }

      onConnected({
        pageName:
          body.selection?.pageName?.trim() ||
          "Facebook Page",
        socialAccountId:
          typeof body.selection?.socialAccountId === "string"
            ? body.selection.socialAccountId
            : selectedId,
        profileImageUrl:
          body.selection?.profileImageUrl ?? null,
      });
    } catch {
      setState("temporary");
      setMessage(
        "The Facebook Page could not be selected. You can retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  const canRetry =
    state === "temporary" ||
    state === "rate_limited" ||
    state === "malformed" ||
    state === "empty" ||
    state === "error";

  const showList = state === "ready" || state === "selecting";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="facebook-page-selection-title"
        className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="facebook-page-selection-title"
              className="text-base font-semibold text-slate-950"
            >
              Select Facebook Page
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {message}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy && state === "selecting"}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
            aria-label="Close page selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {state === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Pages from Facebook…
            </div>
          ) : null}

          {showList ? (
            <ul className="space-y-2">
              {pages.map((page) => {
                const disabled = !page.selectable || busy;
                const selected =
                  selectedId === page.socialAccountId;

                return (
                  <li key={page.socialAccountId}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        setSelectedId(page.socialAccountId)
                      }
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        selected
                          ? "border-indigo-400 bg-indigo-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      } disabled:cursor-not-allowed disabled:opacity-55`}
                    >
                  {page.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={page.profileImageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                          {page.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-950">
                          {page.name}
                        </span>
                        {page.category ? (
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {page.category}
                          </span>
                        ) : null}
                        {page.isCurrentSelection ? (
                          <span className="mt-1 block text-xs text-emerald-700">
                            Currently connected to this brand
                          </span>
                        ) : null}
                        {page.unavailableReason ===
                        "already_connected" &&
                        !page.isCurrentSelection ? (
                          <span className="mt-1 block text-xs text-amber-700">
                            Already connected in this workspace
                          </span>
                        ) : null}
                        {page.unavailableReason ===
                        "insufficient_access" ? (
                          <span className="mt-1 block text-xs text-amber-700">
                            Insufficient Page access
                          </span>
                        ) : null}
                        {page.selectable &&
                        page.limitationLabel ? (
                          <span className="mt-1 block text-xs text-amber-700">
                            {page.limitationLabel}
                          </span>
                        ) : null}
                        {page.selectable &&
                        page.fullyManageable ? (
                          <span className="mt-1 block text-xs text-emerald-700">
                            Full Page management access
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!showList && state !== "loading" ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No Pages to show yet. Use Retry to load them again.
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            {canRetry ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void loadPages()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy && state === "selecting"}
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={
                !selectedId ||
                busy ||
                state !== "ready"
              }
              onClick={() => void confirmSelection()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === "selecting" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Confirm Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
