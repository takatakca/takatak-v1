"use client";
// Phase 14 — Dashboard error boundary. No stacks, no secrets.
import Link from "next/link";
import { useDashboardLanguage } from "@/components/layout/dashboard-language";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const fr = useDashboardLanguage() === "fr";
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">{fr ? "Erreur du tableau de bord" : "Dashboard error"}</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">{fr ? "Cette section n’a pas pu se charger" : "This section failed to load"}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {fr ? "L’erreur a été enregistrée en toute sécurité. Réessayez, ou revenez à la vue d’ensemble du tableau de bord." : "The error was logged safely. Retry, or return to the dashboard overview."}
        </p>
        {error.digest ? <p className="mt-2 font-mono text-[11px] text-slate-400">Reference: {error.digest}</p> : null}
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={() => reset()} className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            {fr ? "Réessayer" : "Try again"}
          </button>
          <Link href="/dashboard" className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            {fr ? "Vue d’ensemble du tableau de bord" : "Dashboard overview"}
          </Link>
        </div>
      </div>
    </div>
  );
}
