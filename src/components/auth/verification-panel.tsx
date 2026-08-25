"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { useRef, useState } from "react";

type ResendVerificationResponse = {
  ok: boolean;
  message?: string;
};

export function VerificationPanel() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";

  const submissionInProgressReference = useRef(false);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  async function resendVerificationEmail() {
    if (
      !email ||
      loading ||
      submissionInProgressReference.current
    ) {
      return;
    }

    submissionInProgressReference.current = true;
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(
        "/api/auth/resend-verification",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
          }),
        },
      );

      let result: ResendVerificationResponse;

      try {
        result =
          (await response.json()) as ResendVerificationResponse;
      } catch {
        setErrorMessage(
          "The verification service returned an invalid response.",
        );
        return;
      }

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.message ??
            "Unable to resend the verification email.",
        );
        return;
      }

      setSuccessMessage(
        result.message ?? "Verification email sent.",
      );
    } catch {
      setErrorMessage(
        "A network error occurred. Check your connection and try again.",
      );
    } finally {
      submissionInProgressReference.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200">
        <MailCheck
          className="h-7 w-7"
          aria-hidden="true"
        />
      </span>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Check your email
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          We sent a verification link
          {email ? (
            <>
              {" "}
              to <strong>{email}</strong>
            </>
          ) : null}
          . Open the link to verify your account.
        </p>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 text-left text-xs leading-5 text-slate-600 ring-1 ring-inset ring-slate-200">
        The email may take a few minutes to arrive. Check your
        spam or junk folder before requesting another email.
      </div>

      {successMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"
        >
          <CheckCircle2
            className="h-4 w-4"
            aria-hidden="true"
          />

          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          onClick={resendVerificationEmail}
          disabled={!email || loading}
          aria-busy={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        >
          {loading ? (
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
          ) : null}

          {loading
            ? "Sending…"
            : "Resend verification email"}
        </button>

        {!email ? (
          <p className="text-xs leading-5 text-slate-500">
            Return to registration to request another
            verification email.
          </p>
        ) : null}

        <Link
          href="/login"
          className="block rounded-md text-xs font-semibold text-primary hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}