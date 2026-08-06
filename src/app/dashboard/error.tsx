"use client";
// Phase 14 — Dashboard error boundary. No stacks, no secrets.
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Dashboard error</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">This section failed to load</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          The error was logged safely. Retry, or return to the dashboard overview.
        </p>
        {error.digest ? <p className="mt-2 font-mono text-[11px] text-slate-400">Reference: {error.digest}</p> : null}
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={() => reset()} className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Try again
          </button>
          <Link href="/dashboard" className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Dashboard overview
          </Link>
        </div>
      </div>
    </div>
  );
}
