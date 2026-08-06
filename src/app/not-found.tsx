import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-500">404</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">This page does not exist</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          The route you requested was not found in the TAKATAK dashboard.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/dashboard" className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Go to dashboard
          </Link>
          <Link href="/" className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
