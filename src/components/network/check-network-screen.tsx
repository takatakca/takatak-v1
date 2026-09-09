"use client";

import { WifiOff } from "lucide-react";

export function CheckNetworkScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <WifiOff className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-semibold text-slate-900">
          Check your network
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          TAKATAK could not reach the server. Confirm your internet connection,
          then try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
