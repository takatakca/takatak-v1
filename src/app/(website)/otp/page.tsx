import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "@/lib/website/nav";
import { OtpForm } from "@/components/auth/otp-form";

export const metadata = {
  title: "Enter your code",
  robots: { index: false, follow: false },
};

function OtpLoadingState() {
  return (
    <div className="flex min-h-48 items-center justify-center" role="status">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    </div>
  );
}

export default function OtpPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-bold text-foreground">
          Please enter the one-time password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 6-digit code we sent you. It expires in 5 minutes.
        </p>
        <div className="mt-6">
          <Suspense fallback={<OtpLoadingState />}>
            <OtpForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary">
            Return to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
