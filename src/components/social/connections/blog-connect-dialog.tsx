"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { SocialPlatformIcon } from "@/components/social/navigation/social-platform-icon";

type BlogConnectionView = {
  status: "connected";
  host: string;
  siteUrl: string;
  blogPath: string;
  blogUrl: string;
  displayName: string;
};

type ApiResult = {
  ok?: boolean;
  message?: string;
  website?: { siteUrl: string; host: string } | null;
  connection?: BlogConnectionView | null;
};

async function readJson(response: Response): Promise<ApiResult> {
  try {
    return (await response.json()) as ApiResult;
  } catch {
    return {};
  }
}

export function BlogConnectDialog({
  businessBrandId,
  onClose,
  onConnected,
}: {
  businessBrandId: string;
  onClose: () => void;
  onConnected: (host: string) => void;
}) {
  const [website, setWebsite] = useState<{ siteUrl: string; host: string } | null>(
    null,
  );
  const [connection, setConnection] = useState<BlogConnectionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/social/connections/blog?businessBrandId=${encodeURIComponent(businessBrandId)}`,
          {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
          },
        );
        const result = await readJson(response);
        if (cancelled) return;
        if (!response.ok || !result.ok) {
          setError(result.message ?? "The blog connection could not be loaded.");
          return;
        }
        setWebsite(result.website ?? null);
        setConnection(result.connection ?? null);
      } catch {
        if (!cancelled) {
          setError("A network error occurred while loading the blog connection.");
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

  async function createBlogPage() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/social/connections/blog", {
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
        setError(result.message ?? "The blog page could not be created.");
        return;
      }
      setConnection(result.connection);
    } catch {
      setError("A network error occurred while creating the blog page.");
    } finally {
      setBusy(false);
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
        aria-labelledby="blog-connect-title"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#b8cdd1]/40">
              <SocialPlatformIcon platform="blog" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2
                id="blog-connect-title"
                className="text-lg font-semibold text-slate-950"
              >
                Connect a blog
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                TAKATAK creates a blog page for the website already connected to
                this brand.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close blog connection"
            disabled={busy}
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
            Loading blog connection
          </div>
        ) : connection ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-6 text-slate-700">
              The blog page for{" "}
              <span className="font-medium">{connection.host}</span> is on
              TAKATAK.
            </p>
            <a
              href={connection.blogUrl}
              className="block truncate text-sm font-medium text-[#4934d4] hover:underline"
              rel="noreferrer"
              target="_blank"
            >
              {connection.blogUrl}
            </a>
            <button
              type="button"
              onClick={() => onConnected(connection.host)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#4934d4] px-4 text-sm font-semibold text-white transition hover:bg-[#3e2bc0]"
            >
              Done
            </button>
          </div>
        ) : website ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-6 text-slate-700">
              Create the TAKATAK blog page for{" "}
              <span className="font-medium">{website.siteUrl}</span>. It stays
              linked to this verified website.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void createBlogPage()}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#b8cdd1] px-5 text-sm font-semibold text-slate-950 transition hover:bg-[#aac1c6] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create blog page"}
            </button>
          </div>
        ) : (
          <p className="mt-5 text-sm leading-6 text-slate-700">
            Connect a web page first. A blog page is created for that website.
          </p>
        )}
      </section>
    </div>
  );
}
