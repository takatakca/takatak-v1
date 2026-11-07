"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Phone } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { normalizePhone, type PhoneCountry } from "@/lib/auth/otp/phone";
import { normalizeEmail, validateEmail } from "@/lib/auth/registration-validation";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";
import { formatAuthErrorMessage, parseAuthResponse } from "@/lib/auth/parse-auth-response";
import { localizeLoginEmailError, loginCopy, loginPath } from "@/lib/auth/login-copy";
import { useLanguage } from "@/lib/website/use-language";

type Mode = "phone" | "email";

export function MasterPhoneLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inFlight = useRef(false);
  const [mode, setMode] = useState<Mode>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>("CA");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const next = sanitizeNextPath(searchParams.get("next"));
  const { lang } = useLanguage();
  const copy = loginCopy(lang);

  async function handlePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || inFlight.current) return;
    const phone = normalizePhone(phoneInput, phoneCountry);
    if (!phone) {
      setError(copy.invalidPhone);
      return;
    }

    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      // One request only. Never automatically retry an uncertain SMS send.
      const response = await fetch("/api/auth/sms-login", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await parseAuthResponse(response);
      if (!result.ok) {
        setError(formatAuthErrorMessage(result));
        return;
      }
    } catch {
      setError(copy.smsUncertain);
      return;
    } finally {
      setLoading(false);
      inFlight.current = false;
    }

    sessionStorage.setItem("verifyPhone", phone);
    sessionStorage.removeItem("verifyEmail");
    sessionStorage.removeItem("otpAttempts");
    const otpUrl = new URL("/otp", window.location.origin);
    otpUrl.searchParams.set("phone", phone);
    otpUrl.searchParams.set("provider", "supabase-phone");
    if (next !== "/dashboard") otpUrl.searchParams.set("next", next);
    if (lang === "fr") otpUrl.searchParams.set("lang", "fr");
    router.push(`${otpUrl.pathname}${otpUrl.search}`);
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || inFlight.current) return;
    const normalizedEmail = normalizeEmail(email);
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setError(localizeLoginEmailError(emailError, lang));
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
      if (lang === "fr") otpUrl.searchParams.set("lang", "fr");
      router.push(`${otpUrl.pathname}${otpUrl.search}`);
    } catch {
      setError(copy.network);
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
        <button type="button" onClick={() => { setMode("phone"); setError(null); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-inset ${mode === "phone" ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-foreground ring-border"}`}>{copy.sms}</button>
        <button type="button" onClick={() => { setMode("email"); setError(null); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-inset ${mode === "email" ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-foreground ring-border"}`}>{copy.email}</button>
      </div>

      {mode === "phone" ? (
        <form onSubmit={handlePhone} className="space-y-4">
          <div>
            <label htmlFor="login-phone" className="mb-1.5 block text-xs font-semibold text-foreground">{copy.phoneLabel}</label>
            <label htmlFor="login-phone-country" className="mb-1 block text-xs font-semibold text-foreground">{copy.countryLabel}</label>
            <select id="login-phone-country" value={phoneCountry} disabled={loading}
              onChange={(event) => { setPhoneCountry(event.target.value as PhoneCountry); setError(null); }}
              className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground">
              <option value="CA">{copy.countryCA}</option>
              <option value="NG">{copy.countryNG}</option>
              <option value="INTL">{copy.countryIntl}</option>
            </select>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input id="login-phone" type="tel" autoComplete="tel" inputMode="tel" value={phoneInput} disabled={loading} onChange={(event) => { setPhoneInput(event.target.value); setError(null); }} className={inputClass} placeholder={phoneCountry === "NG" ? "070 1234 5678" : phoneCountry === "INTL" ? "+44 7700 900123" : "+1 514 555 0123"} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60" style={{ backgroundImage: "var(--gradient-hero)" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {loading ? copy.sending : copy.sendSms}
          </button>
        </form>
      ) : (
        <form onSubmit={handleEmail} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-foreground">{copy.emailLabel}</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input id="login-email" type="email" autoComplete="email" inputMode="email" value={email} disabled={loading} onChange={(event) => { setEmail(event.target.value); setError(null); }} className={inputClass} placeholder="you@company.com" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60" style={{ backgroundImage: "var(--gradient-hero)" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {loading ? copy.sending : copy.sendEmail}
          </button>
        </form>
      )}

      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p> : null}

      <p className="text-center text-xs text-muted-foreground">
        {copy.newPrompt}{" "}
        <Link href={loginPath("/register", lang)} className="font-semibold text-primary">{copy.createIdentity}</Link>
      </p>
    </div>
  );
}
