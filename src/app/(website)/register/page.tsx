import { TriangleAlert } from "lucide-react";
import { Link } from "@/lib/website/nav";
import { RegistrationForm } from "@/components/auth/registration-form";
import { SignupPromoPanel } from "@/components/website/promotions/SignupPromoPanel";
import { isSupabaseConfigured } from "@/lib/auth/env";

export const metadata = {
  title: "Create account",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-8 px-4 py-16 lg:grid-cols-[1fr_1.1fr]">
      <SignupPromoPanel />
      <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-bold text-foreground">Start with TAKATAK</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your TAKATAK account. We will send a one-time password to
          your email.
        </p>
        <div className="mt-6">
          {configured ? (
            <RegistrationForm />
          ) : (
            <div className="space-y-3 text-center">
              <TriangleAlert className="mx-auto h-6 w-6 text-warning" />
              <p className="text-sm font-medium text-foreground">
                Authentication is not configured
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Add the Supabase public URL and anonymous key to your local
                environment, then restart the development server.
              </p>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
