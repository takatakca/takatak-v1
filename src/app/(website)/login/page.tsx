import { Suspense } from "react";
import { TriangleAlert } from "lucide-react";
import { Link } from "@/lib/website/nav";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/auth/env";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your TAKATAK account.
        </p>
        <div className="mt-6">
          {configured ? (
            <Suspense>
              <LoginForm />
            </Suspense>
          ) : (
            <div className="space-y-3 text-center">
              <TriangleAlert className="mx-auto h-6 w-6 text-warning" />
              <p className="text-sm font-medium text-foreground">
                Auth not configured yet
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Supabase environment variables are missing. Add them locally, then
                restart the development server.
              </p>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to TAKATAK?{" "}
          <Link to="/register" className="text-primary">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
