"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { SocialPlatformIcon } from "@/components/social/navigation/social-platform-icon";

type WebConnectionView = {
  status: "pending_verification" | "connected";
  siteUrl: string;
  host: string;
  displayName: string | null;
  metaTag: string | null;
};

type ApiResult = {
  ok?: boolean;
  message?: string;
  connection?: WebConnectionView | null;
};

async function readJson(response: Response): Promise<ApiResult> {
  try {
    return (await response.json()) as ApiResult;
  } catch {
    return {};
  }
}

export function WebSiteConnectDialog({
  businessBrandId,
  onClose,
  onConnected,
}: {
  businessBrandId: string;
  onClose: () => void;
  onConnected: (host: string) => void;
}) {
  const [siteUrl, setSiteUrl] = useState("");
  const [connection, setConnection] = useState<WebConnectionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/social/connections/web?businessBrandId=${encodeURIComponent(businessBrandId)}`,
          {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
          },
        );
        const result = await readJson(response);
        if (cancelled) return;
        if (!response.ok || !result.ok) {
          setError(result.message ?? "The website connection could not be loaded.");
          return;
        }
        if (result.connection?.status === "pending_verification") {
          setConnection(result.connection);
          setSiteUrl(result.connection.siteUrl);
        } else if (result.connection?.status === "connected") {
          setConnection(result.connection);
          setSiteUrl(result.connection.siteUrl);
        }
      } catch {
        if (!cancelled) {
          setError("A network error occurred while loading website verification.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [businessBrandId]);

  async function startVerification(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy("save");
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/social/connections/web", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessBrandId,
          siteUrl,
        }),
      });
      const result = await readJson(response);
      if (!response.ok || !result.ok || !result.connection) {
        setError(result.message ?? "Website verification could not be started.");
        return;
      }
      setConnection(result.connection);
      setSiteUrl(result.connection.siteUrl);
    } catch {
      setError("A network error occurred while starting website verification.");
    } finally {
      setBusy(null);
    }
  }

  async function verifyHomepage() {
    if (busy) return;
    setBusy("verify");
    setError(null);

    try {
      const response = await fetch("/api/social/connections/web/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessBrandId }),
      });
      const result = await readJson(response);
      if (!response.ok || !result.ok || !result.connection) {
        setError(
          result.message ??
            "The verification tag was not found on the homepage.",
        );
        return;
      }
      onConnected(result.connection.host);
    } catch {
      setError("A network error occurred while verifying the website.");
    } finally {
      setBusy(null);
    }
  }

  async function copyTag() {
    if (!connection?.metaTag) return;
    try {
      await navigator.clipboard.writeText(connection.metaTag);
      setCopied(true);
    } catch {
      setError("The tag could not be copied. Select it and copy it manually.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="web-connect-title"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8790f6]/15">
              <SocialPlatformIcon platform="web" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2
                id="web-connect-title"
                className="text-lg font-semibold text-slate-950"
              >
                Connect a web page
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Verify the public homepage so this brand can claim the website.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close website connection"
            disabled={busy !== null}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading website verification
          </div>
        ) : connection?.status === "connected" ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-6 text-slate-700">
              <span className="font-medium">{connection.host}</span> is already
              connected for this brand.
            </p>
            <button
              type="button"
              onClick={() => onConnected(connection.host)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#4934d4] px-4 text-sm font-semibold text-white transition hover:bg-[#3e2bc0]"
            >
              Done
            </button>
          </div>
        ) : connection?.status === "pending_verification" && connection.metaTag ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-6 text-slate-700">
              Add this tag inside the <span className="font-medium">head</span> of{" "}
              <span className="font-medium">{connection.siteUrl}</span>, publish
              the homepage, then verify. You can remove the tag after verification
              succeeds.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 px-3 py-3 text-xs leading-5 text-slate-100">
              {connection.metaTag}
            </pre>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyTag()}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
              >
                {copied ? "Copied" : "Copy tag"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void verifyHomepage()}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#4934d4] px-4 text-sm font-semibold text-white transition hover:bg-[#3e2bc0] disabled:opacity-60"
              >
                {busy === "verify" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify homepage"
                )}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setConnection(null);
                  setCopied(false);
                }}
                className="inline-flex h-10 items-center justify-center px-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Change address
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={(event) => void startVerification(event)}>
            <label className="block text-sm font-medium text-slate-800">
              Website address
              <input
                type="url"
                required
                inputMode="url"
                autoComplete="url"
                placeholder="https://example.com"
                value={siteUrl}
                onChange={(event) => setSiteUrl(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-950 outline-none ring-[#4934d4] focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null || siteUrl.trim().length === 0}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#8790f6] px-5 text-sm font-semibold text-white transition hover:bg-[#7883ec] disabled:opacity-60"
            >
              {busy === "save" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Continue"
              )}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
