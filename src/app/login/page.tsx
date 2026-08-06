import { Suspense } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/auth/env";

export const metadata = { title: "Sign in — TAKATAK Dashboard", robots: { index: false, follow: false } };

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white">
            T
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              Sign in to TAKATAK
            </h1>
            <p className="text-xs text-slate-400">User Official Dashboard V1</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 ring-1 ring-inset ring-indigo-200">
            Phase 3 Auth Foundation
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {configured ? (
            <Suspense>
              <LoginForm />
            </Suspense>
          ) : (
            <div className="space-y-3 text-center">
              <TriangleAlert className="mx-auto h-6 w-6 text-amber-500" />
              <p className="text-sm font-medium text-slate-800">Auth not configured yet</p>
              <p className="text-xs leading-relaxed text-slate-500">
                Supabase environment variables are missing. Add
                <code className="mx-1 rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>
                and
                <code className="mx-1 rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
                to <code className="rounded bg-slate-100 px-1">.env.local</code>, then restart the dev server.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          <Link href="/" className="font-medium text-indigo-600 hover:text-indigo-500">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
