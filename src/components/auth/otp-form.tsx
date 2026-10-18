"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail, Phone } from "lucide-react";
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import {
  formatAuthErrorMessage,
  parseAuthResponse,
} from "@/lib/auth/parse-auth-response";

export function OtpForm() {
  const searchParams = useSearchParams();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const submissionInProgressReference = useRef(false);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(() => new Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [step, setStep] = useState<"code" | "enter-email">("code");
  const [emailDraft, setEmailDraft] = useState("");

  const next = sanitizeNextPath(searchParams.get("next"));
  const provider = searchParams.get("provider");

  useEffect(() => {
    const queryEmail = searchParams.get("email")?.trim() ?? "";
    const queryPhone = searchParams.get("phone")?.trim() ?? "";

    setEmail(queryEmail);
    setPhone(queryPhone);
    setEmailDraft(queryEmail);

    if (!queryEmail && !queryPhone) {
      setStep("enter-email");
    }

    const storedAttempts = sessionStorage.getItem("otpAttempts");
    if (storedAttempts) {
      setAttempts(Number.parseInt(storedAttempts, 10) || 0);
    }
  }, [searchParams]);

  useEffect(() => {
    sessionStorage.setItem("otpAttempts", String(attempts));
  }, [attempts]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, [step]);

  useEffect(() => {
    if (canResend) {
      return;
    }

    setCountdown(60);
    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [canResend]);

  // Retry profile creation using the already verified Supabase session.
  // No OTP is sent or verified here, so this does not incur SMS charges.
  async function finishVerifiedRegistration() {
    if (submissionInProgressReference.current || loading || !phone) return;
    submissionInProgressReference.current = true;
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("TAKATAK authentication is not configured.");
        return;
      }
      const { data, error: userError } = await supabase.auth.getUser();
      const authPhone = data.user?.phone?.replace(/\\D/g, "") ?? "";
      const expectedPhone = phone.replace(/\\D/g, "");
      if (userError || !data.user?.phone_confirmed_at ||
          !authPhone || authPhone !== expectedPhone) {
        setError("No verified session for this phone is active. Sign in using your registered number.");
        return;
      }
      const response = await fetch("/api/auth/sync-profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = await parseAuthResponse(response);
      if (!result.ok) {
        setError(formatAuthErrorMessage(result) || "Profile synchronization failed. No additional SMS was sent.");
        return;
      }
      sessionStorage.removeItem("verifyEmail");
      sessionStorage.removeItem("verifyPhone");
      sessionStorage.removeItem("otpAttempts");
      window.location.assign(next);
    } catch {
      setError("Profile sync could not be completed. No additional SMS was sent.");
    } finally {
      setLoading(false);
      submissionInProgressReference.current = false;
    }
  }

  async function verifyCode(digits: string[]) {
    if (submissionInProgressReference.current || loading) {
      return;
    }

    if (digits.some((digit) => digit === "")) {
      setError("Please enter all 6 digits");
      return;
    }

    if (!email && !phone) {
      setError("No contact info found. Please return to the login page.");
      return;
    }

    submissionInProgressReference.current = true;
    setLoading(true);
    setError(null);

    try {
      if (provider === "supabase-phone" && phone) {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) {
          setError("TAKATAK authentication is not configured.");
          return;
        }

        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          phone,
          token: digits.join(""),
          type: "sms",
        });

        if (verifyError || !data.session || !data.user) {
          setError(
            verifyError?.message?.toLowerCase().includes("expired")
              ? "That SMS code has expired. Request a new code."
              : "The SMS code is invalid or has expired.",
          );
          setAttempts((current) => current + 1);
          return;
        }

        const syncResponse = await fetch("/api/auth/sync-profile", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        });

        const syncResult = await parseAuthResponse(syncResponse);
        if (!syncResult.ok) {
          setError(
            formatAuthErrorMessage(syncResult) ||
              "Your mobile was verified, but TAKATAK could not finalize your profile.",
          );
          return;
        }

        sessionStorage.removeItem("verifyEmail");
        sessionStorage.removeItem("verifyPhone");
        sessionStorage.removeItem("otpAttempts");
        window.location.assign(next);
        return;
      }

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email || undefined,
          phone: phone || undefined,
          otp: digits.join(""),
          next,
        }),
      });

      const result = await parseAuthResponse(response);

      if (!result.ok) {
        setError(formatAuthErrorMessage(result));
        if (result.code === "invalid_otp") {
          setAttempts((current) => current + 1);
        }
        if (
          result.code === "too_many_attempts" ||
          result.code === "disabled_account"
        ) {
          setLocked(true);
        }
        return;
      }

      sessionStorage.removeItem("verifyEmail");
      sessionStorage.removeItem("verifyPhone");
      sessionStorage.removeItem("otpAttempts");

      window.location.assign(result.redirectTo ?? next);
    } catch {
      setError(
        "A network error occurred. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
      submissionInProgressReference.current = false;
    }
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    await verifyCode(otp);
  }

  function applyDigits(raw: string, startIndex: number) {
    const incoming = raw.replace(/\D/g, "");
    if (!incoming) {
      return;
    }

    const start = incoming.length >= 6 ? 0 : startIndex;
    const nextDigits = [...otp];
    const usable = incoming.slice(0, 6 - start);

    for (let offset = 0; offset < usable.length; offset += 1) {
      nextDigits[start + offset] = usable[offset] ?? "";
    }

    setOtp(nextDigits);
    setError(null);

    const focusIndex = Math.min(start + usable.length, 5);
    inputRefs.current[focusIndex]?.focus();

    if (nextDigits.every((item) => item !== "")) {
      void verifyCode(nextDigits);
    }
  }

  function handleChange(value: string, index: number) {
    const digits = value.replace(/\D/g, "");

    if (digits.length > 1) {
      applyDigits(digits, index);
      return;
    }

    const nextDigits = [...otp];
    nextDigits[index] = digits.slice(-1);
    setOtp(nextDigits);
    setError(null);

    if (digits && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (digits && nextDigits.every((item) => item !== "")) {
      void verifyCode(nextDigits);
    }
  }

  function handlePaste(
    event: ClipboardEvent<HTMLInputElement>,
    index: number,
  ) {
    event.preventDefault();
    applyDigits(event.clipboardData.getData("text"), index);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function resendCode() {
    if (!canResend || loading) {
      return;
    }

    if (!email && !phone) {
      setError("Email or phone number is not found");
      return;
    }

    setLoading(true);
    setError(null);
    setCanResend(false);

    try {
      if (provider === "supabase-phone" && phone) {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) {
          setError("TAKATAK authentication is not configured.");
          setCanResend(true);
          return;
        }

        const { error: resendError } = await supabase.auth.resend({
          type: "sms",
          phone,
        });

        if (resendError) {
          setError("Unable to resend the TAKATAK SMS code. Please try again.");
          setCanResend(true);
          return;
        }

        setAttempts(0);
        setLocked(false);
        return;
      }

      const response = await fetch("/api/auth/resend-code", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email || undefined,
          phone: phone || undefined,
        }),
      });

      const result = await parseAuthResponse(response);
      if (!result.ok) {
        setError(formatAuthErrorMessage(result));
        setCanResend(true);
        return;
      }

      setAttempts(0);
      setLocked(false);
    } catch {
      setError("A network error occurred. Check your connection and try again.");
      setCanResend(true);
    } finally {
      window.setTimeout(() => setCanResend(true), 60_000);
      setLoading(false);
    }
  }

  async function sendToEmail(event: FormEvent) {
    event.preventDefault();
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!nextEmail) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: nextEmail }),
      });

      const result = await parseAuthResponse(response);
      if (!result.ok) {
        setError(formatAuthErrorMessage(result));
        return;
      }

      setEmail(nextEmail);
      setPhone("");
      sessionStorage.setItem("verifyEmail", nextEmail);
      sessionStorage.removeItem("verifyPhone");
      setOtp(new Array(6).fill(""));
      setAttempts(0);
      setLocked(false);
      setStep("code");
    } catch {
      setError("A network error occurred. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "enter-email") {
    return (
      <form onSubmit={sendToEmail} className="space-y-4" aria-busy={loading}>
        <div>
          <label
            htmlFor="otp-email"
            className="mb-1.5 block text-xs font-semibold text-foreground"
          >
            Previously verified recovery email
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="otp-email"
              type="email"
              value={emailDraft}
              onChange={(event) => {
                setEmailDraft(event.target.value);
                setError(null);
              }}
              className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="you@company.com"
            />
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          {loading ? "Sending code…" : "Send sign-in code"}
        </button>

        <button
          type="button"
          onClick={() => {
            setAttempts(0);
            setStep("code");
          }}
          className="block w-full text-center text-xs font-semibold text-primary"
        >
          Use the code already sent
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
      {phone ? (
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
          {phone}
        </p>
      ) : email ? (
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
          {email}
        </p>
      ) : (
        <p className="text-sm font-medium text-rose-700">
          No contact info found. Please return to the login page.
        </p>
      )}

      {provider === "supabase-phone" && phone ? (
        <div className="rounded-lg border border-border p-3 text-sm">
          <p className="mb-2 text-muted-foreground">
            Already verified your SMS? Finish creating your TAKATAK profile without requesting another code.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void finishVerifiedRegistration()}
            className="font-semibold text-primary underline disabled:opacity-60"
          >
            Complete registration without another SMS
          </button>
        </div>
      ) : null}

      <div className="flex justify-center gap-2">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={6}
            value={digit}
            disabled={locked || loading}
            onChange={(event) => handleChange(event.target.value, index)}
            onPaste={(event) => handlePaste(event, index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            aria-label={`Digit ${index + 1}`}
            className={`h-12 w-10 rounded-lg border bg-background text-center text-lg font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted ${
              digit ? "border-border" : "border-rose-300"
            }`}
          />
        ))}
      </div>

      {locked ? (
        <p className="text-center text-xs font-medium text-rose-700">
          You have reached the maximum number of attempts. Please try again
          later.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || locked}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        {loading ? "Verifying…" : "Verify"}
      </button>

      <div className="space-y-2 text-center">
        <button
          type="button"
          onClick={() => void resendCode()}
          disabled={!canResend || loading}
          className="text-xs font-semibold text-primary disabled:text-muted-foreground"
        >
          {canResend
            ? "Resend one-time password"
            : `Please wait… ${countdown}s`}
        </button>
        <button
          type="button"
          onClick={() => {
            setAttempts(0);
            setStep("enter-email");
          }}
          className="block w-full text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Sign in using an already verified recovery email
        </button>
        <Link
          href="/login"
          className="block text-xs font-semibold text-primary"
        >
          Go to Login
        </Link>
      </div>
    </form>
  );
}
