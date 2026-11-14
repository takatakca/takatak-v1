"use client";

// Claude (Anthropic) · 2026-11-12 — the only sign-in and sign-up methods on
// takatak.ca (owner order): an email code, or Google. No phone number.
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { normalizeEmail, validateEmail } from "@/lib/auth/registration-validation";
import { formatAuthErrorMessage, parseAuthResponse } from "@/lib/auth/parse-auth-response";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";

type Mode = "login" | "register";

const GOOGLE_MARK = (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.7 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.5 13.3l7.8 6.1C12.2 13.6 17.6 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.3 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l7.8-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.4 0-11.8-4.1-13.7-9.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

export function EmailGoogleAuthForm({ mode, nextPath }: { mode: Mode; nextPath?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inFlight = useRef(false);
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"email" | "google" | null>(null);
  const next = sanitizeNextPath(nextPath ?? searchParams.get("next"));
  const needsTerms = mode === "register";

  function requireTerms(): boolean {
    if (needsTerms && !accepted) {
      setError("Please accept the Terms and the Privacy Policy to create your account.");
      return false;
    }
    return true;
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || inFlight.current || !requireTerms()) return;
    const normalized = normalizeEmail(email);
    const emailError = validateEmail(normalized);
    if (emailError) {
      setError(emailError);
      return;
    }

    inFlight.current = true;
    setLoading("email");
    setError(null);
    try {
      const response = await fetch("/api/auth/email-code", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const result = await parseAuthResponse(response);
      if (!result.ok) {
        setError(formatAuthErrorMessage(result));
        return;
      }
      sessionStorage.setItem("verifyEmail", normalized);
      sessionStorage.removeItem("verifyPhone");
      sessionStorage.removeItem("otpAttempts");
      const otpUrl = new URL("/otp", window.location.origin);
      otpUrl.searchParams.set("email", normalized);
      otpUrl.searchParams.set("provider", "supabase-email");
      if (next !== "/dashboard") otpUrl.searchParams.set("next", next);
      router.push(`${otpUrl.pathname}${otpUrl.search}`);
    } catch {
      setError("A network error occurred. Check your connection and try again.");
    } finally {
      setLoading(null);
      inFlight.current = false;
    }
  }

  async function handleGoogle() {
    if (loading || inFlight.current || !requireTerms()) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("TAKATAK authentication is not configured.");
      return;
    }
    inFlight.current = true;
    setLoading("google");
    setError(null);
    const callback = new URL("/auth/callback", window.location.origin);
    if (next !== "/dashboard") callback.searchParams.set("next", next);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    // On success the browser is already leaving for Google.
    if (oauthError) {
      setError("Google sign-in could not be started. Please try again or use your email.");
      setLoading(null);
      inFlight.current = false;
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted";
  const busy = loading !== null;

  return (
    <div className="space-y-4" data-auth-form={mode}>
      <form onSubmit={handleEmail} className="space-y-4" noValidate>
        <div>
          <label htmlFor="auth-email" className="mb-1.5 block text-xs font-semibold text-foreground">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="auth-email" type="email" autoComplete="email" inputMode="email" value={email} disabled={busy}
              onChange={(event) => { setEmail(event.target.value); setError(null); }}
              className={inputClass} placeholder="you@company.com" />
          </div>
        </div>
        <button type="submit" disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundImage: "var(--gradient-hero)" }}>
          {loading === "email" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {loading === "email" ? "Sending code…" : "Send email code"}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground" aria-hidden="true">or</p>

      <button type="button" onClick={handleGoogle} disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted disabled:opacity-60">
        {loading === "google" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : GOOGLE_MARK}
        Continue with Google
      </button>

      {needsTerms ? (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={accepted} disabled={busy}
            onChange={(event) => { setAccepted(event.target.checked); setError(null); }}
            className="mt-0.5 h-4 w-4 rounded border-border" />
          <span>
            I accept the <a href="/terms" className="font-semibold text-primary" target="_blank" rel="noopener noreferrer">Terms</a> and
            the <a href="/privacy" className="font-semibold text-primary" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
          </span>
        </label>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          By continuing you accept the{" "}
          <a href="/terms" className="font-semibold text-primary" target="_blank" rel="noopener noreferrer">Terms</a> and the{" "}
          <a href="/privacy" className="font-semibold text-primary" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>
      )}

      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p> : null}
    </div>
  );
}
