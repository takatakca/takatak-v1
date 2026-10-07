"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Phone } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { normalizePhone } from "@/lib/auth/otp/phone";
import { normalizeEmail, validateEmail } from "@/lib/auth/registration-validation";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";
import { formatAuthErrorMessage, parseAuthResponse } from "@/lib/auth/parse-auth-response";
import { phoneAuthMessage } from "@/lib/auth/phone-auth-message";

type Mode = "phone" | "email";

export function MasterPhoneLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inFlight = useRef(false);
  const [mode, setMode] = useState<Mode>("email");
  const [phoneInput, setPhoneInput] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const next = sanitizeNextPath(searchParams.get("next"));

  async function handlePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || inFlight.current) return;
    const phone = normalizePhone(phoneInput);
    if (!phone) {
      setError("Enter a valid mobile number.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("TAKATAK authentication is not configured.");
      return;
    }

    inFlight.current = true;
    setLoading(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    inFlight.current = false;

    if (otpError) {
      setError(phoneAuthMessage(otpError.message, (otpError as { code?: string }).code));
      return;
    }

    sessionStorage.setItem("verifyPhone", phone);
    sessionStorage.removeItem("verifyEmail");
    sessionStorage.removeItem("otpAttempts");
    const otpUrl = new URL("/otp", window.location.origin);
    otpUrl.searchParams.set("phone", phone);
    otpUrl.searchParams.set("provider", "supabase-phone");
    if (next !== "/dashboard") otpUrl.searchParams.set("next", next);
    router.push(`${otpUrl.pathname}${otpUrl.search}`);
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || inFlight.current) return;
    const normalizedEmail = normalizeEmail(email);
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setError(emailError);
      return;
    }

    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const result = await parseAuthResponse(response);
      if (!result.ok) {
        setError(formatAuthErrorMessage(result));
        return;
      }
      sessionStorage.setItem("verifyEmail", normalizedEmail);
      sessionStorage.removeItem("verifyPhone");
      const otpUrl = new URL("/otp", window.location.origin);
      otpUrl.searchParams.set("email", normalizedEmail);
      if (next !== "/dashboard") otpUrl.searchParams.set("next", next);
      router.push(`${otpUrl.pathname}${otpUrl.search}`);
    } catch {
      setError("A network error occurred. Check your connection and try again.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { setMode("phone"); setError(null); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-inset ${mode === "phone" ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-foreground ring-border"}`}>SMS</button>
        <button type="button" onClick={() => { setMode("email"); setError(null); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-inset ${mode === "email" ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-foreground ring-border"}`}>Email</button>
      </div>

      {mode === "phone" ? (
        <form onSubmit={handlePhone} className="space-y-4">
          <div>
            <label htmlFor="login-phone" className="mb-1.5 block text-xs font-semibold text-foreground">TAKATAK mobile number</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input id="login-phone" type="tel" autoComplete="tel" inputMode="tel" value={phoneInput} disabled={loading} onChange={(event) => { setPhoneInput(event.target.value); setError(null); }} className={inputClass} placeholder="+1 514 555 0123" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60" style={{ backgroundImage: "var(--gradient-hero)" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {loading ? "Sending code…" : "Send TAKATAK SMS code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleEmail} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-foreground">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input id="login-email" type="email" autoComplete="email" inputMode="email" value={email} disabled={loading} onChange={(event) => { setEmail(event.target.value); setError(null); }} className={inputClass} placeholder="you@company.com" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60" style={{ backgroundImage: "var(--gradient-hero)" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {loading ? "Sending code…" : "Send email code"}
          </button>
        </form>
      )}

      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p> : null}

      <p className="text-center text-xs text-muted-foreground">
        New to TAKATAK?{" "}
        <Link href="/register" className="font-semibold text-primary">Create your identity</Link>
      </p>
    </div>
  );
}
