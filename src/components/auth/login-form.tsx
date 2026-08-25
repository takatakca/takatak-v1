"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import {
  type FormEvent,
  useRef,
  useState,
} from "react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";

function getCallbackError(
  errorCode: string | null,
): string | null {
  switch (errorCode) {
    case "auth_callback_failed":
      return "The verification link is invalid or has expired. Request a new verification email.";
    case "auth_not_configured":
      return "The authentication service is not configured.";
    case "profile_sync_failed":
      return "Your email was verified, but your profile could not be activated. Please try signing in again.";
    default:
      return null;
  }
}

function getFriendlyLoginError(error: {
  message: string;
  code?: string;
  status?: number;
}): {
  message: string;
  emailNotVerified: boolean;
} {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message.toLowerCase();

  if (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed")
  ) {
    return {
      message:
        "Verify your email address before signing in.",
      emailNotVerified: true,
    };
  }

  if (
    code === "invalid_credentials" ||
    message.includes("invalid login credentials")
  ) {
    return {
      message: "The email or password is incorrect.",
      emailNotVerified: false,
    };
  }

  if (
    error.status === 429 ||
    code.includes("rate_limit") ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  ) {
    return {
      message:
        "Too many sign-in attempts. Please wait before trying again.",
      emailNotVerified: false,
    };
  }

  if (
    typeof error.status === "number" &&
    error.status >= 500
  ) {
    return {
      message:
        "The authentication service is temporarily unavailable.",
      emailNotVerified: false,
    };
  }

  if (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed") ||
    message.includes("fetch failed") ||
    code === "network_error"
  ) {
    return {
      message:
        "Sign-in failed because of a network problem. Check your internet connection and try again.",
      emailNotVerified: false,
    };
  }

  return {
    message: "Unable to sign in. Please try again.",
    emailNotVerified: false,
  };
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionInProgressReference = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(
    getCallbackError(searchParams.get("error")),
  );

  const [emailNotVerified, setEmailNotVerified] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      loading ||
      submissionInProgressReference.current
    ) {
      return;
    }

    setError(null);
    setEmailNotVerified(false);

    const normalizedEmail = email
      .normalize("NFKC")
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setError(
        "The authentication service is not configured.",
      );
      return;
    }

    submissionInProgressReference.current = true;
    setLoading(true);

    try {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (signInError) {
        const friendlyError =
          getFriendlyLoginError(signInError);

        setError(friendlyError.message);
        setEmailNotVerified(
          friendlyError.emailNotVerified,
        );

        return;
      }

      const destination = sanitizeNextPath(
        searchParams.get("next"),
      );

      router.replace(destination);
      router.refresh();
    } catch (error) {
      const raw =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "";
      const normalized = raw.toLowerCase();
    
      if (
        normalized.includes("failed to fetch") ||
        normalized.includes("networkerror") ||
        normalized.includes("network request failed") ||
        normalized.includes("load failed") ||
        normalized.includes("fetch failed")
      ) {
        setError(
          "Sign-in failed because of a network problem. Check your internet connection and try again.",
        );
      } else {
        setError(
          "Sign-in failed because of a network problem. Check your internet connection and try again.",
        );
      }
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
              setEmailNotVerified(false);
            }}
            className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted"
            placeholder="you@company.com"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-semibold text-foreground"
        >
          Password
        </label>

        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            disabled={loading}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
            className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-11 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted"
            placeholder="Enter your password"
          />

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              setShowPassword(
                (currentValue) => !currentValue,
              )
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
            aria-label={
              showPassword
                ? "Hide password"
                : "Show password"
            }
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff
                className="h-4 w-4"
                aria-hidden="true"
              />
            ) : (
              <Eye
                className="h-4 w-4"
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="space-y-2 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          <p>{error}</p>

          {emailNotVerified && email.trim() ? (
            <Link
              href={`/register/verify?email=${encodeURIComponent(
                email.trim().toLowerCase(),
              )}`}
              className="inline-block font-semibold text-primary underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Resend verification email
            </Link>
          ) : null}
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
          <Loader2
            className="h-4 w-4 animate-spin"
            aria-hidden="true"
          />
        ) : null}

        {loading ? "Signing in…" : "Sign in"}
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