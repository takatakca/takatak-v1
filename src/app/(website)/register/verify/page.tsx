import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "@/lib/website/nav";
import { VerificationPanel } from "@/components/auth/verification-panel";

export const metadata = {
  title: "Verify your email",
  robots: {
    index: false,
    follow: false,
  },
};

function VerificationLoadingState() {
  return (
    <div className="flex min-h-48 items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading verification details…
      </div>
    </div>
  );
}

export default function VerifyRegistrationPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm your address to finish creating your TAKATAK account.
        </p>
        <div className="mt-6">
          <Suspense fallback={<VerificationLoadingState />}>
            <VerificationPanel />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/register" className="text-primary">
            Return to registration
          </Link>
        </p>
      </div>
    </div>
  );
}
