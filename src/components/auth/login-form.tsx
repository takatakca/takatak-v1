"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";
import {
  formatAuthErrorMessage,
  parseAuthResponse,
} from "@/lib/auth/parse-auth-response";

function getCallbackError(errorCode: string | null): string | null {
  switch (errorCode) {
    case "session_expired":
      return "Your session expired. Sign in again to continue.";
    case "auth_callback_failed":
      return "The verification code is invalid or has expired. Request a new code.";
    case "auth_not_configured":
      return "The authentication service is not configured.";
    case "profile_sync_failed":
      return "Your account could not be activated. Please try signing in again.";
    default:
      return null;
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionInProgressReference = useRef(false);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(
    getCallbackError(searchParams.get("error")),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      searchParams.get("signed_out") === "1" ||
      searchParams.get("error") === "session_expired"
    ) {
      sessionStorage.removeItem("verifyEmail");
      sessionStorage.removeItem("verifyPhone");
      sessionStorage.removeItem("otpAttempts");
    }
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || submissionInProgressReference.current) {
      return;
    }

    setError(null);

    const normalizedEmail = email.normalize("NFKC").trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    submissionInProgressReference.current = true;
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const result = await parseAuthResponse(response);

      if (!result.ok) {
        setError(formatAuthErrorMessage(result));
        return;
      }

      const next = sanitizeNextPath(searchParams.get("next"));
      sessionStorage.setItem("verifyEmail", normalizedEmail);
      sessionStorage.removeItem("verifyPhone");

      const otpUrl = new URL("/otp", window.location.origin);
      otpUrl.searchParams.set("email", normalizedEmail);
      if (next !== "/dashboard") {
        otpUrl.searchParams.set("next", next);
      }

      router.push(`${otpUrl.pathname}${otpUrl.search}`);
    } catch {
      setError(
        "Sign-in failed because of a network problem. Check your internet connection and try again.",
      );
    } finally {
      setLoading(false);
      submissionInProgressReference.current = false;
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
      aria-busy={loading}
    >
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-xs font-semibold text-foreground"
        >
          Email
        </label>

        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            id="email"
            name="email"
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            disabled={loading}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
            className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted"
            placeholder="you@company.com"
          />
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          <p>{error}</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        aria-disabled={loading}
        aria-busy={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}

        {loading ? "Sending code…" : "Login"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Do not have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-primary hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Create Account
        </Link>
      </p>
    </form>
  );
}
