import Link from "next/link";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { VerificationPanel } from "@/components/auth/verification-panel";

export const metadata = {
  title: "Verify your email — TAKATAK Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

function VerificationLoadingState() {
  return (
    <div
      className="flex min-h-48 items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <Loader2
          className="h-4 w-4 animate-spin"
          aria-hidden="true"
        />

        Loading verification details…
      </div>
    </div>
  );
}

export default function VerifyRegistrationPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="flex justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white">
            T
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <Suspense fallback={<VerificationLoadingState />}>
            <VerificationPanel />
          </Suspense>
        </div>

        <p className="text-center text-xs text-slate-400">
          <Link
            href="/register"
            className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            ← Return to registration
          </Link>
        </p>
      </div>
    </main>
  );
}