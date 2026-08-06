import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { RegistrationForm } from "@/components/auth/registration-form";
import { isSupabaseConfigured } from "@/lib/auth/env";

export const metadata = {
  title: "Create account — TAKATAK Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-xl space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white">
            T
          </span>

          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Create your TAKATAK account
            </h1>

            <p className="mt-1 text-xs text-slate-500">
              Enter your information to access the User Official Dashboard.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          {configured ? (
            <RegistrationForm />
          ) : (
            <div className="space-y-3 text-center">
              <TriangleAlert
                className="mx-auto h-6 w-6 text-amber-500"
                aria-hidden="true"
              />

              <p className="text-sm font-medium text-slate-800">
                Authentication is not configured
              </p>

              <p className="text-xs leading-relaxed text-slate-500">
                Add the Supabase public URL and anonymous key to
                your local environment, then restart the
                development server.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          <Link
            href="/"
            className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}