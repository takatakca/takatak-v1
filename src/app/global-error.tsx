"use client";
// Phase 14 — Root-level error boundary. Safe by design: no stack traces,
// no provider responses, no secrets. Shows only Next's safe digest.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Application error</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            The error was logged safely. No details are shown here by design.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-[11px] text-slate-400">Reference: {error.digest}</p>
          ) : null}
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Try again
            </button>
            {/* Plain anchor on purpose: global-error renders when the app
                shell itself failed, so avoid depending on the client router. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Return home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
